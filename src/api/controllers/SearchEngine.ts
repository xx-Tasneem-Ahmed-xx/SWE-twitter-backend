// ===========================
// TYPES & INTERFACES
// ===========================
import { parse as parseHtml } from "node-html-parser";
import { prisma as clientPrisma } from "@/prisma/client";
import type { PrismaClient } from "@prisma/client";

import Redis from "ioredis";
import { PorterStemmer } from "natural";
import Levenshtein from "fast-levenshtein";
import { apiRoutes } from "../routes/searchRoutes";
import { getSecrets } from "@/config/secrets";
// Logger utility
const { DEBUG } = getSecrets();
export class Logger {
  private context: string;
  constructor(context: string) {
    this.context = context;
  }
  info(msg: string, data?: any) {
    console.log(`[${this.context}]   ${msg}`, data || "");
  }
  error(msg: string, error?: any) {
    console.error(`[${this.context}]  ${msg}`, error || "");
  }
  warn(msg: string, data?: any) {
    console.warn(`[${this.context}]   ${msg}`, data || "");
  }
  debug(msg: string, data?: any) {
    if (DEBUG) console.log(`[${this.context}] 🐛 ${msg}`, data || "");
  }
}

export interface CrawledTweet {
  id: string;
  content: string;
  userId: string;
  username: string;
  createdAt: Date;
  likesCount: number;
  retweetCount: number;
  hashtags: string[];
}

export interface CrawledUser {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  verified: boolean;
  followersCount?: number;
  followingsCount?: number;
}

export interface CrawledHashtag {
  id: string;
  tag: string;
  tweetCount: number;
}

export interface ParsedDocument {
  id: string;
  type: "tweet" | "user" | "hashtag" | "url";
  tokens: string[];
  stemmedTokens: string[];
  data: any;
  timestamp: number;
  url?: string;
  title?: string;
  length: number;
}

export interface InvertedIndex {
  [term: string]: Set<string>;
}

export interface DocumentFrequency {
  [term: string]: number;
}

export interface SearchResult {
  id: string;
  type: "tweet" | "user" | "hashtag" | "url";
  score: number;
  tfidfScore: number;
  data: any;
  matchedTokens?: string[];
  relevance: number;
}

export interface PaginatedResults {
  query: string;
  type: string;
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  timestamp: string;
}

export interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  tweets: number;
  users: number;
  hashtags: number;
  urls: number;
  averageDocLength: number;
  indexSize: string;
}

// ===========================
// ADVANCED TOKENIZER
// ===========================

export class AdvancedTokenizer {
  private stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "will",
    "with",
    "this",
    "but",
    "they",
    "have",
    "had",
    "or",
    "not",
    "been",
    "being",
    "can",
    "could",
    "would",
    "should",
    "i",
    "me",
    "my",
    "you",
    "your",
    "we",
    "our",
    "what",
    "which",
    "who",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "then",
    "now",
    "here",
  ]);

  private emojiRegex = /(\u00d7|\u2763|\u{1F300}-\u{1F9FF})/gu;
  private logger = new Logger("Tokenizer");

  tokenize(text: string): string[] {
    try {
      // Remove emojis but keep hashtags and mentions
      let cleaned = text.replace(this.emojiRegex, " ");

      // Normalize URLs
      cleaned = cleaned.replace(/https?:\/\/\S+/gi, "URL");

      // Split on whitespace and punctuation
      const words = cleaned
        .toLowerCase()
        .replace(/[^\w\s#@]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1);

      // Filter stopwords
      return words.filter((word) => !this.stopWords.has(word));
    } catch (error) {
      this.logger.error("Tokenization failed", error);
      return [];
    }
  }

  stem(word: string): string {
    try {
      // Handle hashtags and mentions specially
      if (word.startsWith("#") || word.startsWith("@")) {
        return word;
      }
      // use the correct PorterStemmer API
      return PorterStemmer.stem(word);
    } catch (error) {
      return word;
    }
  }

  normalizeHashtag(tag: string): string {
    return tag.toLowerCase().replace(/^#+/, "");
  }

  tokenizeAndStem(text: string): { tokens: string[]; stemmed: string[] } {
    const tokens = this.tokenize(text);
    const stemmed = tokens.map((t) => this.stem(t));
    return { tokens, stemmed };
  }
}

// ===========================
// PERSISTENCE LAYER
// ===========================

export class PersistenceManager {
  private redis: Redis;
  private logger = new Logger("Persistence");

  constructor(redisUrl: string = "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
    this.redis.on("error", (err) => this.logger.error("Redis error", err));
    this.redis.on("connect", () => this.logger.info("Redis connected"));
  }

  async saveIndex(
    indexData: any,
    indexName: string = "search_index"
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(indexData);
      await this.redis.set(`${indexName}:data`, serialized);
      await this.redis.set(`${indexName}:timestamp`, Date.now().toString());
      this.logger.info(`Index saved: ${indexName}`);
      return true;
    } catch (error) {
      this.logger.error("Failed to save index", error);
      return false;
    }
  }

  async loadIndex(indexName: string = "search_index"): Promise<any | null> {
    try {
      const data = await this.redis.get(`${indexName}:data`);
      if (!data) {
        this.logger.warn(`Index not found: ${indexName}`);
        return null;
      }
      this.logger.info(`Index loaded: ${indexName}`);
      return JSON.parse(data);
    } catch (error) {
      this.logger.error("Failed to load index", error);
      return null;
    }
  }

  async cacheSearchResults(
    query: string,
    results: any,
    ttl: number = 3600
  ): Promise<void> {
    try {
      const key = `search:${query.toLowerCase()}`;
      await this.redis.setex(key, ttl, JSON.stringify(results));
    } catch (error) {
      this.logger.warn("Failed to cache results", error);
    }
  }

  async getCachedResults(query: string): Promise<any | null> {
    try {
      const key = `search:${query.toLowerCase()}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
    this.logger.info("Redis connection closed");
  }
}

// ===========================
// BM25 RANKING ALGORITHM
// ===========================

export class BM25Ranker {
  private k1 = 1.5; // Term frequency saturation
  private b = 0.75; // Length normalization
  private logger = new Logger("BM25");

  calculateBM25(
    query: string[],
    documentTokens: string[],
    invertedIndex: InvertedIndex,
    allDocuments: Map<string, ParsedDocument>,
    collectionSize: number
  ): number {
    let score = 0;
    const docLength = documentTokens.length;
    const avgDocLength = this.calculateAverageDocLength(allDocuments);

    for (const term of query) {
      const docFreq = invertedIndex[term]?.size || 0;
      const termFreq = documentTokens.filter((t) => t === term).length;

      if (docFreq === 0) continue;

      const idf = Math.log(
        (collectionSize - docFreq + 0.5) / (docFreq + 0.5) + 1
      );
      const normLength = 1 - this.b + this.b * (docLength / avgDocLength);
      const bm25Term =
        (idf * ((this.k1 + 1) * termFreq)) / (this.k1 * normLength + termFreq);

      score += bm25Term;
    }

    return score;
  }

  calculateTFIDF(
    queryTerm: string,
    documentTokens: string[],
    invertedIndex: InvertedIndex,
    collectionSize: number
  ): number {
    const termFreq = documentTokens.filter((t) => t === queryTerm).length;
    const docFreq = invertedIndex[queryTerm]?.size || 1;
    const idf = Math.log(collectionSize / docFreq);
    return termFreq * idf;
  }

  private calculateAverageDocLength(
    documents: Map<string, ParsedDocument>
  ): number {
    if (documents.size === 0) return 0;
    const totalLength = Array.from(documents.values()).reduce(
      (sum, doc) => sum + doc.length,
      0
    );
    return totalLength / documents.size;
  }
}

// ===========================
// FUZZY SEARCH
// ===========================

export class FuzzyMatcher {
  private logger = new Logger("FuzzyMatcher");
  private threshold = 0.7; // 70% similarity

  fuzzyMatch(query: string, candidates: string[]): string[] {
    try {
      return candidates.filter((candidate) => {
        const distance = Levenshtein.get(
          query.toLowerCase(),
          candidate.toLowerCase()
        );
        const maxLen = Math.max(query.length, candidate.length);
        const similarity = 1 - distance / maxLen;
        return similarity >= this.threshold;
      });
    } catch (error) {
      this.logger.error("Fuzzy matching failed", error);
      return [];
    }
  }

  findClosestMatch(query: string, candidates: string[]): string | null {
    if (candidates.length === 0) return null;

    let bestMatch = candidates[0];
    let bestScore = 0;

    for (const candidate of candidates) {
      const distance = Levenshtein.get(
        query.toLowerCase(),
        candidate.toLowerCase()
      );
      const maxLen = Math.max(query.length, candidate.length);
      const similarity = 1 - distance / maxLen;

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = candidate;
      }
    }

    return bestScore >= this.threshold ? bestMatch : null;
  }
}

// ===========================
// DATABASE CRAWLER
// ===========================

export class Crawler {
  private prisma: PrismaClient;
  private logger = new Logger("Crawler");
  private batchSize = 500;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async crawlTweets(
    limit: number = 1000,
    offset: number = 0
  ): Promise<CrawledTweet[]> {
    this.logger.info(`Crawling tweets: limit=${limit}, offset=${offset}`);

    try {
      const tweets = await this.prisma.tweet.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { username: true } },
          hashtags: { include: { hash: true } },
        },
      });

      this.logger.info(`Crawled ${tweets.length} tweets`);
      return tweets.map((tweet) => ({
        id: tweet.id,
        content: tweet.content,
        userId: tweet.userId,
        username: tweet.user.username,
        createdAt: tweet.createdAt,
        likesCount: tweet.likesCount || 0,
        retweetCount: tweet.retweetCount || 0,
        hashtags: tweet.hashtags.map((h) => h.hash.tag_text),
      }));
    } catch (error) {
      this.logger.error("Error crawling tweets", error);
      return [];
    }
  }

  async crawlUsers(
    limit: number = 1000,
    offset: number = 0
  ): Promise<CrawledUser[]> {
    this.logger.info(`Crawling users: limit=${limit}, offset=${offset}`);

    try {
      const users = await this.prisma.user.findMany({
        take: limit,
        skip: offset,
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          verified: true,
          _count: { select: { followers: true, followings: true } },
        },
      });

      this.logger.info(`Crawled ${users.length} users`);
      return users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.bio,
        verified: user.verified,
        followersCount: user._count?.followers || 0,
        followingsCount: user._count?.followings || 0,
      }));
    } catch (error) {
      this.logger.error("Error crawling users", error);
      return [];
    }
  }

  async crawlHashtags(
    limit: number = 1000,
    offset: number = 0
  ): Promise<CrawledHashtag[]> {
    this.logger.info(`Crawling hashtags: limit=${limit}, offset=${offset}`);

    try {
      const hashtags = await this.prisma.hash.findMany({
        take: limit,
        skip: offset,
        include: { _count: { select: { tweets: true } } },
      });

      this.logger.info(`Crawled ${hashtags.length} hashtags`);
      return hashtags.map((hash) => ({
        id: hash.id,
        tag: hash.tag_text,
        tweetCount: hash._count?.tweets || 0,
      }));
    } catch (error) {
      this.logger.error("Error crawling hashtags", error);
      return [];
    }
  }

  async crawlUrl(url: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const html = await response.text();
      return { url, html };
    } catch (error) {
      // Handle fetch abort separately for clearer logs
      if ((error as any)?.name === "AbortError") {
        this.logger.warn(`Fetch aborted due to timeout for URL ${url}`);
      } else {
        this.logger.error(`Error crawling URL ${url}`, error);
      }
      return null;
    }
  }

  async crawlMultiple(urls: string[]) {
    const results = await Promise.allSettled(
      urls.map((url) => this.crawlUrl(url))
    );
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((r) => r !== null);
  }

  async crawlInBatches(
    type: "tweets" | "users" | "hashtags",
    totalLimit: number = 10000
  ) {
    this.logger.info(`Starting batch crawl: type=${type}, limit=${totalLimit}`);
    const allData = [];
    let offset = 0;

    while (offset < totalLimit) {
      const batchLimit = Math.min(this.batchSize, totalLimit - offset);
      let batchData: string | any[] = [];

      if (type === "tweets") {
        batchData = await this.crawlTweets(batchLimit, offset);
      } else if (type === "users") {
        batchData = await this.crawlUsers(batchLimit, offset);
      } else if (type === "hashtags") {
        batchData = await this.crawlHashtags(batchLimit, offset);
      }

      if (batchData.length === 0) break;
      allData.push(...batchData);
      offset += batchData.length;

      this.logger.debug(`Batch progress: ${offset}/${totalLimit}`);
    }

    this.logger.info(`Batch crawl complete: collected ${allData.length} items`);
    return allData;
  }

  async crawlAll() {
    return Promise.all([
      this.crawlTweets(),
      this.crawlUsers(),
      this.crawlHashtags(),
    ]);
  }
}

// ===========================
// PARSER
// ===========================

export class Parser {
  private tokenizer: AdvancedTokenizer;
  private logger = new Logger("Parser");

  constructor() {
    this.tokenizer = new AdvancedTokenizer();
  }

  parseTweet(tweet: CrawledTweet): ParsedDocument {
    const { tokens, stemmed } = this.tokenizer.tokenizeAndStem(tweet.content);

    return {
      id: tweet.id,
      type: "tweet",
      tokens,
      stemmedTokens: stemmed,
      data: tweet,
      timestamp: tweet.createdAt.getTime(),
      length: tokens.length,
    };
  }

  parseUser(user: CrawledUser): ParsedDocument {
    const text = [user.username, user.name || "", user.bio || ""].join(" ");
    const { tokens, stemmed } = this.tokenizer.tokenizeAndStem(text);

    return {
      id: user.id,
      type: "user",
      tokens,
      stemmedTokens: stemmed,
      data: user,
      timestamp: Date.now(),
      length: tokens.length,
    };
  }

  parseHashtag(hashtag: CrawledHashtag): ParsedDocument {
    const normalized = this.tokenizer.normalizeHashtag(hashtag.tag);
    const { tokens, stemmed } = this.tokenizer.tokenizeAndStem(normalized);

    return {
      id: hashtag.id,
      type: "hashtag",
      tokens,
      stemmedTokens: stemmed,
      data: hashtag,
      timestamp: Date.now(),
      length: tokens.length,
    };
  }

  parseUrl(page: { url: string; html: string }): ParsedDocument {
    try {
      const root = parseHtml(page.html);
      const title = root.querySelector("title")?.text || "";
      const bodyText = (root as any).text || "";
      const text = title + " " + bodyText;
      const { tokens, stemmed } = this.tokenizer.tokenizeAndStem(text);

      return {
        id: page.url,
        type: "url",
        tokens,
        stemmedTokens: stemmed,
        data: { url: page.url, title, text: text.substring(0, 500) },
        timestamp: Date.now(),
        url: page.url,
        title,
        length: tokens.length,
      };
    } catch (error) {
      this.logger.error("Error parsing URL", error);
      throw error;
    }
  }

  parseMultiple(items: any[]): ParsedDocument[] {
    const docs: ParsedDocument[] = [];

    for (const item of items) {
      try {
        if (item.html && item.url) {
          docs.push(this.parseUrl(item));
        } else if (item.content && item.username) {
          docs.push(this.parseTweet(item));
        } else if (item.bio !== undefined && item.username) {
          docs.push(this.parseUser(item));
        } else if (item.tag) {
          docs.push(this.parseHashtag(item));
        }
      } catch (error) {
        this.logger.warn("Error parsing item", error);
      }
    }

    return docs;
  }

  getTokenizer(): AdvancedTokenizer {
    return this.tokenizer;
  }
}

// ===========================
// INDEXER
// ===========================

export class Indexer {
  private invertedIndex: InvertedIndex = {};
  private stemmedIndex: InvertedIndex = {};
  private documents: Map<string, ParsedDocument> = new Map();
  private documentFrequency: DocumentFrequency = {};
  private typeIndex: Map<string, Set<string>> = new Map([
    ["tweet", new Set()],
    ["user", new Set()],
    ["hashtag", new Set()],
    ["url", new Set()],
  ]);
  private logger = new Logger("Indexer");
  private indexSize = 0;

  index(parsedDoc: ParsedDocument): void {
    this.documents.set(parsedDoc.id, parsedDoc);
    this.typeIndex.get(parsedDoc.type)?.add(parsedDoc.id);

    // Index original tokens
    parsedDoc.tokens.forEach((token) => {
      if (!this.invertedIndex[token]) {
        this.invertedIndex[token] = new Set();
        this.documentFrequency[token] = 0;
      }
      this.invertedIndex[token].add(parsedDoc.id);
      this.documentFrequency[token]++;
    });

    // Index stemmed tokens
    parsedDoc.stemmedTokens.forEach((token) => {
      if (!this.stemmedIndex[token]) {
        this.stemmedIndex[token] = new Set();
      }
      this.stemmedIndex[token].add(parsedDoc.id);
    });

    this.indexSize += JSON.stringify(parsedDoc).length;
  }

  indexMultiple(parsedDocs: ParsedDocument[]): void {
    parsedDocs.forEach((doc) => this.index(doc));
    this.logger.info(`Indexed ${parsedDocs.length} documents`);
  }

  getInvertedIndex(): InvertedIndex {
    return this.invertedIndex;
  }

  getStemmedIndex(): InvertedIndex {
    return this.stemmedIndex;
  }

  getDocuments(): Map<string, ParsedDocument> {
    return this.documents;
  }

  getDocumentsByType(
    type: "tweet" | "user" | "hashtag" | "url"
  ): ParsedDocument[] {
    const docIds = this.typeIndex.get(type) || new Set();
    return Array.from(docIds)
      .map((id) => this.documents.get(id))
      .filter((doc): doc is ParsedDocument => doc !== undefined);
  }

  getDocumentFrequency(): DocumentFrequency {
    return this.documentFrequency;
  }

  getIndexStats(): IndexStats {
    const avgLength =
      this.documents.size > 0
        ? Array.from(this.documents.values()).reduce(
            (sum, doc) => sum + doc.length,
            0
          ) / this.documents.size
        : 0;

    return {
      totalDocuments: this.documents.size,
      totalTerms: Object.keys(this.invertedIndex).length,
      tweets: this.typeIndex.get("tweet")?.size || 0,
      users: this.typeIndex.get("user")?.size || 0,
      hashtags: this.typeIndex.get("hashtag")?.size || 0,
      urls: this.typeIndex.get("url")?.size || 0,
      averageDocLength: Math.round(avgLength),
      indexSize: `${(this.indexSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  clear(): void {
    this.invertedIndex = {};
    this.stemmedIndex = {};
    this.documents.clear();
    this.documentFrequency = {};
    this.typeIndex = new Map([
      ["tweet", new Set()],
      ["user", new Set()],
      ["hashtag", new Set()],
      ["url", new Set()],
    ]);
    this.indexSize = 0;
    this.logger.info("Index cleared");
  }
}

// ===========================
// SEARCH ENGINE
// ===========================

export class SearchEngine {
  private indexer: Indexer;
  private parser: Parser;
  private bm25Ranker: BM25Ranker;
  private fuzzyMatcher: FuzzyMatcher;
  private persistence: PersistenceManager;
  private logger = new Logger("SearchEngine");

  constructor(
    indexer: Indexer,
    parser: Parser,
    persistence?: PersistenceManager
  ) {
    this.indexer = indexer;
    this.parser = parser;
    this.bm25Ranker = new BM25Ranker();
    this.fuzzyMatcher = new FuzzyMatcher();
    this.persistence = persistence || new PersistenceManager();
  }

  private searchPhrase(
    phrase: string,
    type: "tweet" | "user" | "hashtag" | "url" | "all" = "all"
  ): string[] {
    const words = phrase.split(/\s+/);
    const invertedIndex = this.indexer.getInvertedIndex();
    let matchingDocs = new Set<string>();

    words.forEach((word, idx) => {
      const docIds = invertedIndex[word] || new Set();
      if (idx === 0) {
        matchingDocs = new Set(docIds);
      } else {
        matchingDocs = new Set(
          [...matchingDocs].filter((id) => docIds.has(id))
        );
      }
    });

    if (type === "all") return Array.from(matchingDocs);

    const typeSet = this.indexer
      .getDocumentsByType(type as any)
      .map((d) => d.id);
    return Array.from(matchingDocs).filter((id) => typeSet.includes(id));
  }

  search(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      type?: "tweet" | "user" | "hashtag" | "url" | "all";
      useFuzzy?: boolean;
      usePhrase?: boolean;
    } = {}
  ): PaginatedResults {
    const {
      limit = 20,
      offset = 0,
      type = "all",
      useFuzzy = false,
      usePhrase = false,
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        query,
        type,
        results: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        pages: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    const tokenizer = this.parser.getTokenizer();
    const { tokens, stemmed } = tokenizer.tokenizeAndStem(query);

    if (tokens.length === 0) {
      this.logger.warn("No valid tokens from query", { query });
      return {
        query,
        type,
        results: [],
        total: 0,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        pages: 0,
        timestamp: new Date().toISOString(),
      };
    }

    let matchingDocIds: Set<string>;

    if (usePhrase) {
      matchingDocIds = new Set(this.searchPhrase(query, type as any));
    } else {
      const invertedIndex = this.indexer.getStemmedIndex();
      matchingDocIds = new Set();

      stemmed.forEach((token) => {
        const docIds = invertedIndex[token] || new Set();
        if (matchingDocIds.size === 0) {
          matchingDocIds = new Set(docIds);
        } else {
          matchingDocIds = new Set([...matchingDocIds, ...docIds]);
        }
      });
    }

    const documents = this.indexer.getDocuments();
    const results: SearchResult[] = [];
    const collectionSize = documents.size;

    matchingDocIds.forEach((docId) => {
      const doc = documents.get(docId);
      if (!doc || (type !== "all" && doc.type !== type)) return;

      const bm25Score = this.bm25Ranker.calculateBM25(
        stemmed,
        doc.stemmedTokens,
        this.indexer.getStemmedIndex(),
        documents,
        collectionSize
      );

      let tfidfScore = 0;
      stemmed.forEach((token) => {
        tfidfScore += this.bm25Ranker.calculateTFIDF(
          token,
          doc.stemmedTokens,
          this.indexer.getStemmedIndex(),
          collectionSize
        );
      });

      let finalScore = bm25Score + tfidfScore * 0.5;

      // Boost scores based on document type and metadata
      if (doc.type === "user" && doc.data.verified) finalScore *= 2;
      if (doc.type === "tweet") {
        finalScore += doc.data.likesCount * 0.01;
        finalScore += doc.data.retweetCount * 0.02;
      }
      if (doc.type === "hashtag") finalScore += doc.data.tweetCount * 0.01;
      if (doc.type === "user") finalScore += doc.data.followersCount * 0.001;

      results.push({
        id: doc.id,
        type: doc.type,
        score: finalScore,
        tfidfScore,
        data: doc.data,
        matchedTokens: tokens.filter(
          (t) =>
            doc.tokens.includes(t) ||
            doc.stemmedTokens.includes(tokenizer.stem(t))
        ),
        relevance: Math.min(
          100,
          Math.round((bm25Score / (collectionSize * 0.1)) * 100)
        ),
      });
    });

    results.sort((a, b) => b.score - a.score);
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    this.logger.info(
      `Search completed: query="${query}" results=${total} time=${
        Date.now() - startTime
      }ms`
    );

    return {
      query,
      type,
      results: paginatedResults,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    };
  }

  searchByType(
    query: string,
    type: "tweet" | "user" | "hashtag" | "url",
    limit: number = 20,
    offset: number = 0
  ): PaginatedResults {
    return this.search(query, { type, limit, offset });
  }
}

// ===========================
// EXPRESS API
// ===========================

// ===========================
// INITIALIZATION & SETUP
// ===========================

export async function initializeSearchEngine(redisUrl?: string) {
  const logger = new Logger("Init");

  try {
    const prisma = clientPrisma;
    const crawler = new Crawler(prisma);
    const parser = new Parser();
    const indexer = new Indexer();
    const persistence = new PersistenceManager(
      redisUrl || "redis://localhost:6379"
    );
    const searchEngine = new SearchEngine(indexer, parser, persistence);

    logger.info("Search engine initialized successfully");

    return {
      crawler,
      parser,
      indexer,
      searchEngine,
      persistence,
      apiRoutes: (app: any) =>
        app.use(
          "/api",
          apiRoutes(crawler, parser, indexer, searchEngine, persistence)
        ),
    };
  } catch (error) {
    logger.error("Failed to initialize search engine", error);
    throw error;
  }
}

// ===== USAGE EXAMPLE =====
/*
import express from 'express';

const app = express();
app.use(express.json());

initializeSearchEngine('redis://localhost:6379').then(({ apiRoutes }) => {
  apiRoutes(app);
  app.listen(3000, () => console.log('Server running on port 3000'));
});
*/
