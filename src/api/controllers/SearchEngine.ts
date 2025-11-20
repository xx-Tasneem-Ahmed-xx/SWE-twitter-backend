// ===========================
// TYPES & INTERFACES
// ===========================

interface CrawledTweet {
  id: string;
  content: string;
  userId: string;
  username: string;
  createdAt: Date;
  likesCount: number;
  retweetCount: number;
  hashtags: string[];
}

interface CrawledUser {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  verified: boolean;
  followersCount?: number;
  followingsCount?: number;
}

interface CrawledHashtag {
  id: string;
  tag: string;
  tweetCount: number;
}

interface ParsedDocument {
  id: string;
  type: 'tweet' | 'user' | 'hashtag';
  tokens: string[];
  data: any;
  timestamp: number;
}

interface InvertedIndex {
  [term: string]: Set<string>; // term -> document IDs
}

interface SearchResult {
  id: string;
  type: 'tweet' | 'user' | 'hashtag';
  score: number;
  data: any;
}

// ===========================
// DATABASE CRAWLER
// ===========================

import { PrismaClient } from '@prisma/client';

export class Crawler {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async crawlTweets(limit: number = 1000, offset: number = 0): Promise<CrawledTweet[]> {
    console.log(`Crawling tweets: limit=${limit}, offset=${offset}`);
    
    const tweets = await this.prisma.tweet.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true
          }
        },
        hashtags: {
          include: {
            hash: true
          }
        }
      }
    });

    return tweets.map(tweet => ({
      id: tweet.id,
      content: tweet.content,
      userId: tweet.userId,
      username: tweet.user.username,
      createdAt: tweet.createdAt,
      likesCount: tweet.likesCount,
      retweetCount: tweet.retweetCount,
      hashtags: tweet.hashtags.map(h => h.hash.tag_text)
    }));
  }

  async crawlUsers(limit: number = 1000, offset: number = 0): Promise<CrawledUser[]> {
    console.log(`Crawling users: limit=${limit}, offset=${offset}`);
    
    const users = await this.prisma.user.findMany({
      take: limit,
      skip: offset,
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        verified: true,
        _count: {
          select: {
            followers: true,
            followings: true
          }
        }
      }
    });

    return users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      verified: user.verified,
      followersCount: user._count.followers,
      followingsCount: user._count.followings
    }));
  }

  async crawlHashtags(limit: number = 1000, offset: number = 0): Promise<CrawledHashtag[]> {
    console.log(`Crawling hashtags: limit=${limit}, offset=${offset}`);
    
    const hashtags = await this.prisma.hash.findMany({
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            tweets: true
          }
        }
      }
    });

    return hashtags.map(hash => ({
      id: hash.id,
      tag: hash.tag_text,
      tweetCount: hash._count.tweets
    }));
  }

  async crawlAll() {
    const [tweets, users, hashtags] = await Promise.all([
      this.crawlTweets(),
      this.crawlUsers(),
      this.crawlHashtags()
    ]);

    return { tweets, users, hashtags };
  }

  async searchTweetsByContent(query: string, limit: number = 20) {
    return await this.prisma.tweet.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive'
        }
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            verified: true
          }
        }
      }
    });
  }

  async searchUsersByUsername(query: string, limit: number = 20) {
    return await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: limit,
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        verified: true,
        _count: {
          select: {
            followers: true,
            followings: true
          }
        }
      }
    });
  }

  async searchHashtags(query: string, limit: number = 20) {
    return await this.prisma.hash.findMany({
      where: {
        tag_text: {
          contains: query,
          mode: 'insensitive'
        }
      },
      take: limit,
      include: {
        _count: {
          select: {
            tweets: true
          }
        }
      }
    });
  }
}

// ===========================
// PARSER
// ===========================

export class Parser {
  private stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
    'or', 'not', 'been', 'being', 'can', 'could', 'would', 'should'
  ]);

  parseTweet(tweet: CrawledTweet): ParsedDocument {
    const tokens = this.tokenize(tweet.content);
    
    return {
      id: tweet.id,
      type: 'tweet',
      tokens,
      data: tweet,
      timestamp: tweet.createdAt.getTime()
    };
  }

  parseUser(user: CrawledUser): ParsedDocument {
    const text = [
      user.username,
      user.name || '',
      user.bio || ''
    ].join(' ');
    
    const tokens = this.tokenize(text);
    
    return {
      id: user.id,
      type: 'user',
      tokens,
      data: user,
      timestamp: Date.now()
    };
  }

  parseHashtag(hashtag: CrawledHashtag): ParsedDocument {
    const tokens = this.tokenize(hashtag.tag);
    
    return {
      id: hashtag.id,
      type: 'hashtag',
      tokens,
      data: hashtag,
      timestamp: Date.now()
    };
  }

  parseMultiple(items: any[], type: 'tweet' | 'user' | 'hashtag'): ParsedDocument[] {
    switch (type) {
      case 'tweet':
        return items.map(item => this.parseTweet(item));
      case 'user':
        return items.map(item => this.parseUser(item));
      case 'hashtag':
        return items.map(item => this.parseHashtag(item));
      default:
        return [];
    }
  }

  private tokenize(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s#@]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);

    const filtered = words.filter(word => !this.stopWords.has(word));
    
    return filtered;
  }
}

// ===========================
// INDEXER
// ===========================

export class Indexer {
  private invertedIndex: InvertedIndex = {};
  private documents: Map<string, ParsedDocument> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map([
    ['tweet', new Set()],
    ['user', new Set()],
    ['hashtag', new Set()]
  ]);

  index(parsedDoc: ParsedDocument): void {
    // Store document
    this.documents.set(parsedDoc.id, parsedDoc);
    
    // Add to type index
    this.typeIndex.get(parsedDoc.type)?.add(parsedDoc.id);

    // Build inverted index
    parsedDoc.tokens.forEach(token => {
      if (!this.invertedIndex[token]) {
        this.invertedIndex[token] = new Set();
      }
      this.invertedIndex[token].add(parsedDoc.id);
    });

    console.log(`Indexed ${parsedDoc.type}: ${parsedDoc.id}`);
  }

  indexMultiple(parsedDocs: ParsedDocument[]): void {
    parsedDocs.forEach(doc => this.index(doc));
  }

  getInvertedIndex(): InvertedIndex {
    return this.invertedIndex;
  }

  getDocuments(): Map<string, ParsedDocument> {
    return this.documents;
  }

  getDocumentsByType(type: 'tweet' | 'user' | 'hashtag'): ParsedDocument[] {
    const docIds = this.typeIndex.get(type) || new Set();
    return Array.from(docIds)
      .map(id => this.documents.get(id))
      .filter((doc): doc is ParsedDocument => doc !== undefined);
  }

  getIndexStats() {
    return {
      totalDocuments: this.documents.size,
      totalTerms: Object.keys(this.invertedIndex).length,
      tweets: this.typeIndex.get('tweet')?.size || 0,
      users: this.typeIndex.get('user')?.size || 0,
      hashtags: this.typeIndex.get('hashtag')?.size || 0
    };
  }

  clear(): void {
    this.invertedIndex = {};
    this.documents.clear();
    this.typeIndex = new Map([
      ['tweet', new Set()],
      ['user', new Set()],
      ['hashtag', new Set()]
    ]);
  }
}

// ===========================
// SEARCH ENGINE
// ===========================

export class SearchEngine {
  private indexer: Indexer;
  private parser: Parser;

  constructor(indexer: Indexer) {
    this.indexer = indexer;
    this.parser = new Parser();
  }

  search(
    query: string,
    options: {
      limit?: number;
      type?: 'tweet' | 'user' | 'hashtag' | 'all';
    } = {}
  ): SearchResult[] {
    const { limit = 20, type = 'all' } = options;

    const queryTokens = this.parser['tokenize'](query);
    
    if (queryTokens.length === 0) {
      return [];
    }

    const docScores = new Map<string, number>();
    const invertedIndex = this.indexer.getInvertedIndex();

    // Calculate scores based on token matches
    queryTokens.forEach(token => {
      const docIds = invertedIndex[token];
      if (docIds) {
        docIds.forEach(docId => {
          const currentScore = docScores.get(docId) || 0;
          docScores.set(docId, currentScore + 1);
        });
      }
    });

    const documents = this.indexer.getDocuments();
    const results: SearchResult[] = [];

    docScores.forEach((score, docId) => {
      const doc = documents.get(docId);
      if (doc && (type === 'all' || doc.type === type)) {
        // Boost score for verified users
        if (doc.type === 'user' && doc.data.verified) {
          score *= 1.5;
        }
        
        // Boost score for popular tweets
        if (doc.type === 'tweet') {
          score += (doc.data.likesCount * 0.01);
          score += (doc.data.retweetCount * 0.02);
        }

        results.push({
          id: doc.id,
          type: doc.type,
          score,
          data: doc.data
        });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  searchByType(query: string, type: 'tweet' | 'user' | 'hashtag', limit: number = 20) {
    return this.search(query, { type, limit });
  }
}

// ===========================
// EXPRESS API
// ===========================



// Initialize Prisma and components


// ===========================
// API ENDPOINTS
// ===========================

// Health check
