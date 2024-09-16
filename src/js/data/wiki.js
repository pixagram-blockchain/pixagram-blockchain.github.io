export default function getIT() {
    return {
        "wiki": {
            "title": "PIXA Blockchain & Pixagram Platform Documentation",
            "version": "2.0.0",
            "lastUpdated": "2025",
            "overview": "PIXA is a specialized blockchain for pixel art, built on Graphene technology with native NFT support and on-chain storage. It features a tri-token economy, proof-of-brain consensus, and democratic governance.",
            "parts": [
                {
                    "id": "part-1",
                    "title": "Part I: Technical Foundation",
                    "sections": [
                        {
                            "id": "1.1",
                            "title": "Core Architecture",
                            "content": `# 1.1 Core Architecture

## Overview
PIXA blockchain provides permanent, on-chain storage for pixel art using cryptographic immutability and distributed consensus.

## Key Components

### Blockchain Infrastructure
- **Technology Stack**: Graphene-based (inherited from Steem/Hive)
- **Consensus**: Delegated Proof-of-Stake (DPoS) with 21 witnesses
- **Block Time**: 3 seconds
- **Hashing**: SHA-256 for cryptographic security

### Storage Innovation
- **On-Chain Storage**: Images stored directly as Base64 data
- **Size Optimization**: 3-30KB file size sweet spot
- **Permanence**: Data exists as long as any node maintains the chain
- **No External Dependencies**: Unlike traditional NFTs, no IPFS or external hosting

### Economic Integration
**Proof-of-Brain (PoB)**: Community voting determines content value
- Stake-weighted voting power
- Non-linear reward curves favor quality
- 7-day evaluation periods for content

**Governance Features**
- Witness elections through continuous voting
- Decentralized fund for development
- Parameter adjustments by consensus

## Technical Advantages

### Why Pixel Art?
- **Storage Efficiency**: Pixel art achieves maximum compression
- **Deterministic Rendering**: Pixels display identically everywhere
- **Cultural Relevance**: Strong nostalgic and artistic appeal
- **Technical Simplicity**: Lower computational overhead

### Network Properties
- **Immutability**: Published content cannot be altered or deleted
- **Censorship Resistance**: Decentralized storage across all nodes
- **Economic Alignment**: Creators, curators, and stakeholders share incentives`
                        },
                        {
                            "id": "1.2",
                            "title": "Evolution from Steem/Hive",
                            "content": `# 1.2 Evolution from Steem/Hive

## Blockchain Lineage

### Steem (2016): The Pioneer
**Innovation**: First blockchain to reward content creation
**Technology**: Graphene framework, 3-second blocks, DPoS consensus
**Limitation**: Corporate centralization led to community exit

### Hive (2020): The Fork
**Catalyst**: Community rejected corporate takeover
**Improvement**: True decentralization, community fund (DHF)
**Foundation**: Preserved Steem's technology, removed central control

### PIXA (2024): The Specialization
**Focus**: Pixel art exclusively
**Innovation**: On-chain image storage
**Enhancement**: Native NFT support at Layer-1

## Technical Inheritance

### From Graphene Framework
- 3-second block times
- High throughput capacity
- Hierarchical key system
- Resource credit model

### From Steem/Hive
- Proof-of-Brain rewards
- Stake-weighted voting
- 7-day payout cycles
- Witness governance

### PIXA-Specific Evolution

**Storage Optimization**
- Base64 encoding for images
- WebP compression support
- Size-constrained efficiency

**Economic Innovations**
- Big Mac Index stablecoin (PXS)
- Deflationary fee burning
- Native NFT marketplace

**Specialized Features**
- Pixel art focus only
- Built-in editor tools
- Multi-rendering engines

## Comparison Matrix

| Feature | Steem | Hive | PIXA |
|---------|-------|------|------|
| **Block Time** | 3 sec | 3 sec | 3 sec |
| **Consensus** | DPoS | DPoS | DPoS |
| **Content Type** | Text/Blog | Text/Blog | Pixel Art |
| **Storage** | Text only | Text only | Images on-chain |
| **NFT Support** | None | Limited | Native Layer-1 |
| **Stablecoin** | USD (SBD) | USD (HBD) | Big Mac (PXS) |
| **Governance** | Corporate | Community | Community |`
                        }
                    ]
                },
                {
                    "id": "part-2",
                    "title": "Part II: Token Economy",
                    "sections": [
                        {
                            "id": "2.1",
                            "title": "Tri-Token System",
                            "content": `# 2.1 Tri-Token System

## Token Types

### PIXA Coin (PXA) - Liquid Currency
**Purpose**: Primary exchange medium
**Properties**:
- Freely tradeable
- Instant transfers
- Exchange listing compatible
- Entry point for new users

**Use Cases**:
- Buy/sell NFTs
- Trade on exchanges
- Convert to other tokens
- Pay transaction fees

### PIXA Power (PXP) - Governance Token
**Purpose**: Voting power and platform access
**Properties**:
- 13-week power-down period
- Generates resource credits
- Determines voting weight
- Non-transferable while locked

**Key Functions**:
- **Voting Power**: √(PXP amount) determines influence
- **Bandwidth**: More PXP = more transactions allowed
- **Curation Rewards**: Earn by voting on quality content
- **Witness Elections**: Choose block producers

**Power-Down Mechanics**:
- Takes 13 weeks total
- 1/13 released weekly
- Provides exit liquidity
- Prevents panic selling

### PIXA Supra (PXS) - Stable Token
**Purpose**: Price stability for commerce
**Peg**: Big Mac Index (global purchasing power)
**Mechanism**: Witness price feeds + 3.5-day average

**Unique Features**:
- Not pegged to USD
- Reflects real purchasing power
- Global price discovery
- Inflation-resistant design

**Conversion Process**:
1. Request PXA → PXS conversion
2. Wait 3.5 days (price averaging)
3. Receive PXS at median rate
4. 10% debt limit for system safety

## Token Interactions

### Conversion Flows
\`\`\`
                            PXA ←→ PXP (instant staking, 13-week unstaking)
    PXA ←→ PXS (3.5-day conversion, market rate)
    PXP generates → Resource Credits (for transactions)
        \`\`\`

### Economic Balance
- **Inflation**: Creates new tokens (9.5% → 0.95% over time)
- **Deflation**: Marketplace fees burned permanently
- **Equilibrium**: Supply/demand balanced by multiple mechanisms`
},
    {
        "id": "2.2",
        "title": "Distribution & Inflation",
        "content": `# 2.2 Distribution & Inflation

## Inflation Schedule

### Starting Rate: 9.5% Annual
- Decreases by 0.5% yearly
- Terminal rate: 0.95% (after ~17 years)
- Predictable monetary policy
- Sustainable long-term economics

## Token Distribution

### Content Rewards: 70%
**Author Rewards** (75% of content pool)
- Creators earn for quality pixel art
- Payout after 7-day voting period
- Higher stakes = stronger votes

**Curation Rewards** (25% of content pool)
- Voters earn for finding quality early
- Rewards decrease over time
- Incentivizes content discovery

### Witness Rewards: 12.5%
- Top 20 witnesses share majority
- Backup witnesses receive remainder
- Covers infrastructure costs
- Ensures network security

### Decentralized Pixa Fund: 17.5%
- Community-controlled treasury
- Funds development proposals
- Marketing initiatives
- Infrastructure improvements

## Deflationary Mechanisms

### Fee Burning
**NFT Sales**:
- Initial sale: 10% burned
- Secondary sales: 2.5% burned
- Permanent supply reduction
- Value accrual to holders

**Impact**:
- Counters inflation
- Creates scarcity
- Rewards platform usage
- Sustainable economics

## Genesis Distribution

### Initial 100M PXA Allocation
- **51%**: Public sale participants
- **20.8%**: Decentralized fund
- **15.7%**: Reserve/stability buffer
- **12.5%**: Team & advisors (vested)

### Vesting Schedules
**Team**: 4-year vesting with 1-year cliff
**Advisors**: 2-year vesting with 6-month cliff
**Purpose**: Long-term alignment`
    }
]
},
    {
        "id": "part-3",
        "title": "Part III: Platform Features",
        "sections": [
        {
            "id": "3.1",
            "title": "Pixagram.com Interface",
            "content": `# 3.1 Pixagram.com Interface

## Account System

### Key Hierarchy
Each account has multiple keys for security:
- **Owner Key**: Account recovery, key changes
- **Active Key**: Financial operations, voting
- **Posting Key**: Content creation, social actions
- **Memo Key**: Encrypted messaging

### Account Creation
- Username-based (e.g., @pixartist)
- Resource credits from sponsors
- No email required
- Social recovery options

## Content Discovery

### Feed Types
- **Trending**: High-value content by stake-weighted votes
- **New**: Chronological, unfiltered
- **Hot**: Recent high-engagement
- **Following**: Curated from followed accounts
- **Tags**: Category-based browsing

### Discovery Algorithm
\`\`\`
            Trending Score = (net_votes)² / (time_since_post + 2)²
        \`\`\`
- Quality amplification through quadratic voting
- Time decay ensures freshness
- Tag-based categorization

## Social Features

### Engagement Mechanics
- **Voting**: Distributes rewards based on stake
- **Comments**: Earn rewards like posts
- **Following**: Build curated feeds
- **Reblogging**: Share with attribution
- **Direct Messages**: Encrypted on-chain

### Reward Distribution
- 7-day evaluation period
- Early voters earn more
- Quality threshold for payouts
- Transparent, verifiable rewards

## Proof-of-Brain Implementation

### Voting Power
- Regenerates 20% daily
- Maximum 10 full-power votes/day
- Stake-weighted influence
- Anti-spam mechanisms

### Curation Incentives
- Vote within 5 minutes: Maximum curation rewards
- Vote after 30 minutes: Minimal curation rewards
- Find quality early: Higher returns
- Prevents vote brigading`
    },
        {
            "id": "3.2",
            "title": "PixaPics Editor",
            "content": `# 3.2 PixaPics Editor

## Creation Tools

### AI-Powered Conversion
**Smart Pixelization**:
- Upload any image
- AI analyzes composition
- Intelligent downsampling
- Preserves key features
- Multiple style options

**Processing Pipeline**:
1. Edge detection
2. Color palette extraction
3. Feature preservation
4. Artifact removal
5. Final optimization

### Native Pixel Tools
**Drawing Tools**:
- Pixel-perfect pencil
- Pattern brushes
- Shape primitives
- Flood fill
- Dithering patterns

**Advanced Features**:
- Layer management
- Animation frames
- Symmetry modes
- Tile creation
- Palette editor

### Rendering Engines

**Nearest Neighbor** (Classic)
- Pure pixel preservation
- Sharp edges
- Retro aesthetic
- No interpolation

**xBRZ Upscaling** (Smooth)
- Curved edge smoothing
- Modern appearance
- Resolution independence
- Enhanced details

**Client-Side Processing**
- WebGL acceleration
- No server uploads
- Instant preview
- Privacy preserved

## Workflow Integration

### Creation Process
1. Create or import artwork
2. Edit with pixel tools
3. Choose rendering style
4. Preview results
5. Mint as NFT

### Format Support
- PNG, JPG import
- WebP optimization
- GIF animation
- Size optimization (3-30KB target)`
        },
        {
            "id": "3.3",
            "title": "NFT Marketplace",
            "content": `# 3.3 NFT Marketplace

## Marketplace Structure

### Fee Model
**Primary Sales**: 10% platform fee (burned)
**Secondary Sales**: 2.5% platform fee (burned)
**Creator Royalties**: 0-10% (creator choice)

### On-Chain Guarantee
**Traditional NFTs**:
- Token: On-chain
- Metadata: IPFS/URL
- Image: External server

**PIXA NFTs**:
- Token: On-chain
- Metadata: On-chain
- Image: On-chain (Base64)
- Result: True permanence

## Discovery Features

### Browse Options
- Trending by volume
- New listings
- Price ranges
- Artist collections
- Rarity scores
- Style categories

### Collection Tools
- Create themed sets
- Batch minting
- Collection metadata
- Rarity traits
- Series management

## Trading Mechanics

### Listing Process
1. Select NFT to sell
2. Set price in PXA or PXS
3. Configure royalties
4. Sign transaction
5. Instant listing

### Buying Process
1. Browse marketplace
2. View on-chain image
3. Check ownership history
4. Purchase with PXA/PXS
5. Instant transfer

## Creator Benefits

### Royalty System
- Automatic enforcement
- Every secondary sale
- Creator sets rate (0-10%)
- Perpetual income stream

### Verification
- Artist profiles
- Portfolio showcase
- Sales history
- Follower count
- Verification badges`
        }
    ]
    },
    {
        "id": "part-4",
        "title": "Part IV: Governance",
        "sections": [
        {
            "id": "4.1",
            "title": "Witness System",
            "content": `# 4.1 Witness System

## Witness Role

### Core Responsibilities
- Produce blocks every 3 seconds
- Validate transactions
- Maintain price feeds
- Signal protocol upgrades

### Selection Process
- Top 20 elected by stake-weighted votes
- 1 backup witness per round (rotating)
- Continuous elections (no terms)
- Instant replacement possible

## Voting Mechanics

### How to Vote
1. Power up PXA to PXP
2. Vote for up to 30 witnesses
3. Vote weight = your PXP stake
4. Change votes anytime

### Witness Requirements
- Reliable server infrastructure
- 24/7 uptime commitment
- Technical competence
- Community trust

## Price Feed Duties

### Big Mac Index Oracle
Witnesses report local Big Mac prices to maintain PXS peg:
1. Check local McDonald's prices
2. Convert to PXA exchange rate
3. Submit price feed
4. Median of all feeds = official rate

### Feed Parameters
- Update frequency: Hourly minimum
- Validity period: 24 hours
- 3.5-day averaging window
- Outlier protection via median

## Anti-Collusion Measures

### System Safeguards
- Transparent voting records
- Geographic distribution
- Stake distribution limits
- Community fork capability

### Economic Alignment
- Witnesses hold significant PXA
- Malicious behavior crashes token value
- Reputation crucial for re-election
- Competition from backup witnesses

## Compensation

### Reward Structure
- 12.5% of inflation to witnesses
- Top 20 share 95% equally
- Backups share remaining 5%
- Covers infrastructure costs`
        },
        {
            "id": "4.2",
            "title": "Decentralized Fund",
            "content": `# 4.2 Decentralized Fund (DPF)

## Fund Overview

### Purpose
Community-controlled treasury for platform development
- 17.5% of inflation allocated
- Converted to PXS for stability
- Proposal-based distribution
- Transparent spending

## Proposal System

### Submission Requirements
**Proposal Must Include**:
- Executive summary
- Detailed plan
- Budget breakdown
- Milestones & timeline
- Team credentials
- Success metrics

**Technical Requirements**:
- Minimum 1000 PXP to propose
- 10 PXS submission fee
- 10% budget held in escrow
- Public voting period

## Voting Process

### Stake-Weighted Democracy
- Vote power = PXP holdings
- 7-30 day voting period
- 10% quorum required
- >50% approval needed

### Special Thresholds
Large proposals (>1% monthly budget):
- 15% quorum required
- 66% approval needed
- Extended discussion period

## Fund Allocation

### Typical Distribution
- **Infrastructure**: 30-40%
  - Witness nodes
  - API services
  - Block explorers
  
- **Development**: 25-35%
  - Protocol upgrades
  - New features
  - Security audits
  
- **Marketing**: 20-30%
  - Community events
  - User acquisition
  - Partnerships
  
- **Operations**: 10-20%
  - Legal compliance
  - Emergency reserves
  - Administration

## Success Stories

### Funded Projects
- Wallet development
- Exchange integrations
- Educational content
- Artist grants
- Technical documentation

### Impact Metrics
- ROI tracking
- User growth correlation
- Feature adoption rates
- Community satisfaction`
        }
    ]
    },
    {
        "id": "part-5",
        "title": "Part V: Corporate & Compliance",
        "sections": [
        {
            "id": "5.1",
            "title": "Legal Structure",
            "content": `# 5.1 Legal Structure

## Pixagram SA

### Swiss Corporation
- **Location**: Zug, Switzerland (Crypto Valley)
- **Type**: Stock corporation (Aktiengesellschaft)
- **Purpose**: Develop and launch PIXA blockchain
- **Philosophy**: Progressive decentralization

### Jurisdiction Benefits
- Clear crypto regulations (FINMA)
- Blockchain-friendly environment
- Political stability
- Advanced banking infrastructure
- Access to talent

## Regulatory Compliance

### FINMA Classification
**Utility Token Determination**:
- Platform access functionality
- No dividend rights
- No profit promises
- Immediate utility at launch

**Regulatory Implications**:
- No prospectus required
- No banking license needed
- No securities registration
- Simplified compliance

### Non-Custodial Architecture
**Key Principles**:
- Users control private keys
- Direct blockchain interaction
- Platform provides interface only
- No asset custody

**Benefits**:
- Reduced regulatory burden
- No money transmission license
- Limited liability
- User sovereignty

## Token Classification

### Utility Token Features
**Functional Uses**:
- Governance participation
- Bandwidth allocation
- Content publishing
- NFT minting
- Network security

**Not Securities Because**:
- Functional from day one
- Value from utility, not speculation
- Decentralized value creation
- No passive income promises

## Progressive Decentralization

### Roadmap to Autonomy

**Phase 1** (Months 0-6): Foundation
- Corporate development lead
- Infrastructure deployment
- Regulatory establishment

**Phase 2** (Months 6-12): Launch
- Network activation
- Token distribution
- Governance initialization

**Phase 3** (Months 12-24): Transition
- Community takes control
- DPF funds development
- Corporate role diminishes

**Phase 4** (24+ Months): Autonomy
- Fully decentralized
- Community governance
- Corporate entity optional`
        },
        {
            "id": "5.2",
            "title": "Fundraising Structure",
            "content": `# 5.2 Fundraising Structure

## Token Sale Overview

### Total Genesis: 100 Million PXA

**Distribution**:
- 51M (51%): Public sale
- 20.8M (20.8%): Decentralized fund
- 15.7M (15.7%): Reserve buffer
- 12.5M (12.5%): Team & advisors

### Investment Rounds

| Round | Price | Discount | Allocation | Target |
|-------|-------|----------|------------|---------|
| Pre-Seed | $0.030 | 50% | 4M PXA | $120K |
| Seed | $0.035 | 41.7% | 7M PXA | $245K |
| Community | $0.040 | 33.3% | 20M PXA | $800K |
| Strategic | $0.060 | 0% | 20M PXA | $1.2M |

### Round Strategy
- **Pre-Seed**: Validate concept
- **Seed**: Build infrastructure
- **Community**: Generate grassroots support
- **Strategic**: Institutional validation

## Vesting Schedules

### Team Vesting
- 12-month cliff
- 4-year total vesting
- Monthly releases after cliff
- Prevents immediate selling

### Advisor Vesting
- 6-month cliff
- 2-year total vesting
- Acceleration triggers for major events

### Vesting Purpose
- Long-term alignment
- Market protection
- Confidence signaling
- Retention mechanism

## Reserve Management

### Buffer Allocation (15.7M PXA)

**Purpose Distribution**:
- 30%: Liquidity provision
- 25%: Market stabilization
- 20%: Emergency operations
- 15%: Strategic opportunities
- 10%: Unallocated reserve

### Deployment Strategy
- Multi-signature control
- Transparent reporting
- Algorithmic rebalancing
- Progressive decentralization

## Use of Funds

### Development: 40%
- Core blockchain development
- Platform interface
- Mobile applications
- Security audits

### Operations: 25%
- Team salaries
- Legal compliance
- Office infrastructure
- Professional services

### Marketing: 20%
- Community building
- Partnership development
- Event sponsorship
- Content creation

### Reserve: 15%
- Exchange listings
- Market making
- Contingency fund
- Strategic investments`
        }
    ]
    }
],
    "quickReference": {
        "tokens": {
            "PXA": "Liquid trading token",
                "PXP": "Staked governance token (13-week unlock)",
                "PXS": "Big Mac Index stablecoin"
        },
        "consensus": {
            "type": "Delegated Proof-of-Stake",
                "blockTime": "3 seconds",
                "witnesses": "21 (20 elected + 1 rotating)"
        },
        "economics": {
            "initialInflation": "9.5% annual",
                "terminalInflation": "0.95% (after 17 years)",
                "contentRewards": "70% of inflation",
                "witnessRewards": "12.5% of inflation",
                "communityFund": "17.5% of inflation"
        },
        "marketplace": {
            "primaryFee": "10% (burned)",
                "secondaryFee": "2.5% (burned)",
                "creatorRoyalties": "0-10% (configurable)"
        }
    }
}
};
}