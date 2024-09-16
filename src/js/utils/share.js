/**
 * Cross-platform sharing function
 * - Android/Mobile: Uses native Web Share API
 * - Desktop: Shows modal or copies to clipboard
 *
 * @param {Object} options - Sharing options
 * @param {string} options.url - URL to share (required)
 * @param {string} [options.title] - Title for the share (optional)
 * @param {string} [options.text] - Additional text/description (optional)
 * @param {string} [options.desktopMode='modal'] - Desktop fallback mode: 'modal' or 'clipboard'
 */
export default async function shareContent(options, modal_callback, clipboard_toast_callback) {
    const { url, title = '', text = '', desktopMode = 'clipboard' } = options;

    // Validate required parameter
    if (!url) {
        console.error('URL is required for sharing');
        return;
    }

    // Check if Web Share API is available (primarily mobile devices)
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
            console.log('Content shared successfully');
            return true;
        } catch (error) {
            // User cancelled or error occurred
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
            }
            return false;
        }
    } else {
        // Desktop fallback
        if (desktopMode === 'clipboard') {
            return handleClipboardShare(url, title, text, clipboard_toast_callback);
        } else {
            return modal_callback(url, title, text);
        }
    }
}

/**
 * Handle clipboard sharing (desktop fallback)
 */
async function handleClipboardShare(url, title, text, clipboard_toast_callback) {
    try {
        // Create share text
        const shareText = text
            ? `${title ? title + '\n' : ''}${text}\n${url}`
            : `${title ? title + '\n' : ''}${url}`;

        // Copy to clipboard
        await navigator.clipboard.writeText(shareText);

        // Show notification
        clipboard_toast_callback('Link copied to clipboard!', 2500);
        console.log('Link copied to clipboard');
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);

        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            clipboard_toast_callback('Link copied to clipboard!', 2500);
            return true;
        } catch (err) {
            console.error('Fallback copy failed:', err);
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}