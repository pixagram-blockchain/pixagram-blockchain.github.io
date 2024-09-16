// Utility function to generate trigrams
const FuSe = (function(){
    function getTrigrams(str) {
        str = `  ${str.toLowerCase()} `;
        const trigrams = [];
        for (let i = 0; i < str.length - 2; i++) {
            trigrams.push(str.substring(i, i + 3));
        }
        return trigrams;
    }

// Class for Trie Node
    class TrieNode {
        constructor() {
            this.children = {};
            this.entries = new Set();
        }
    }

// Trie Structure for efficient searching
    class Trie {
        constructor() {
            this.root = new TrieNode();
        }

        insert(string) {
            if (!string) return; // Ensure string is defined
            let node = this.root;
            for (const char of string.toLowerCase()) {
                if (!node.children[char]) node.children[char] = new TrieNode();
                node = node.children[char];
                node.entries.add(string);
            }
        }

        findCandidates(prefix) {
            if (!prefix) return new Set(); // Ensure prefix is defined
            let node = this.root;
            for (const char of prefix.toLowerCase()) {
                if (!node.children[char]) return new Set();
                node = node.children[char];
            }
            return node.entries;
        }
    }

// Main Fuzzy Search Class
    class FuzzySearch {
        constructor(entries = [], options = {}) {
            this._entries = entries;
            this.options = options;
            this.trie = new Trie();
            this.extractKey = options.extractKey || (item => item);
            entries.forEach(entry => this.trie.insert(this.extractKey(entry)));
        }

        get entries() {
            return this._entries;
        }

        set entries(newEntries) {
            this._entries = newEntries;
            this.trie = new Trie();
            newEntries.forEach(entry => this.trie.insert(this.extractKey(entry)));
        }

        trigramSimilarity(str1, str2) {
            const trigrams1 = getTrigrams(str1);
            const trigrams2 = new Set(getTrigrams(str2));
            const matchCount = trigrams1.filter(tri => trigrams2.has(tri)).length;
            return matchCount / trigrams1.length;
        }

        search(query, threshold = 0.3) {
            const candidates = Array.from(new Set([
                ...this.trie.findCandidates(query[0]),
                ...this.entries.map(this.extractKey),
            ]));

            let scored = candidates
                .map(candidate => ({
                    candidate,
                    original: this.entries.find(entry => this.extractKey(entry) === candidate),
                    score: this.trigramSimilarity(query, candidate),
                    lengthDiff: Math.abs(candidate.length - query.length),
                }))
                .filter(item => item.score >= threshold)
                .sort((a, b) => b.score - a.score || a.lengthDiff - b.lengthDiff);

            if (this.options.prepend || this.options.append) {
                scored = scored.map(item => ({
                    ...item,
                    candidate: `${this.options.prepend || ''}${item.candidate}${this.options.append || ''}`,
                }));
            }

            return scored;
        }
    }

    return FuzzySearch;
})();

export default FuSe;