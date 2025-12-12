// src/search/searchEngine.ts
import { Indexer } from "./indexer";
import { Parser, ParsedTweet, ParsedUser } from "./parser";
import { PersistenceManager } from "./persistence";

export interface SearchResult<T> {
  data: T[];
  total: number;
}

export interface TopSearchResult {
  tweets: ParsedTweet[];
  users: ParsedUser[];
}

export class SearchEngine {
  constructor(
    private indexer: Indexer,
    private parser: Parser,
    private persistence: PersistenceManager
  ) {}

  /**
   * Search for top results (tweets + users)
   */
  searchTop(query: string, limit: number = 6): TopSearchResult {
    const parsedQuery = this.parser.parseQuery(query);

    // Search tweets
    let tweetIds = new Set<string>();

    if (parsedQuery.tokens.length > 0) {
      tweetIds = this.indexer.searchTweets(parsedQuery.tokens);
    }

    // Add hashtag results
    parsedQuery.hashtags.forEach((hashtag) => {
      const hashtagResults = this.indexer.searchByHashtag(hashtag);
      hashtagResults.forEach((id) => tweetIds.add(id));
    });

    // Add mention results
    parsedQuery.mentions.forEach((mention) => {
      const mentionResults = this.indexer.searchByMention(mention);
      mentionResults.forEach((id) => tweetIds.add(id));
    });

    // Get tweets and sort by score
    const tweets = this.indexer
      .getTweets(Array.from(tweetIds))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 tweets

    // Search users
    let userIds = new Set<string>();

    if (parsedQuery.tokens.length > 0 || query.trim().length > 0) {
      const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      userIds = this.indexer.searchUsers(queryTokens);
    }

    const users = this.indexer
      .getUsers(Array.from(userIds))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 users

    return {
      tweets,
      users,
    };
  }

  /**
   * Search for people only
   */
  searchPeople(query: string, limit: number = 20): SearchResult<ParsedUser> {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const userIds = this.indexer.searchUsers(queryTokens);

    const users = this.indexer
      .getUsers(Array.from(userIds))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      data: users,
      total: userIds.size,
    };
  }

  /**
   * Search for latest tweets
   */
  searchLatest(query: string, limit: number = 20): SearchResult<ParsedTweet> {
    const parsedQuery = this.parser.parseQuery(query);

    let tweetIds = new Set<string>();

    if (parsedQuery.tokens.length > 0) {
      tweetIds = this.indexer.searchTweets(parsedQuery.tokens);
    }

    // Add hashtag results
    parsedQuery.hashtags.forEach((hashtag) => {
      const hashtagResults = this.indexer.searchByHashtag(hashtag);
      hashtagResults.forEach((id) => tweetIds.add(id));
    });

    // Add mention results
    parsedQuery.mentions.forEach((mention) => {
      const mentionResults = this.indexer.searchByMention(mention);
      mentionResults.forEach((id) => tweetIds.add(id));
    });

    // Sort by creation date (latest first)
    const tweets = this.indexer
      .getTweets(Array.from(tweetIds))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return {
      data: tweets,
      total: tweetIds.size,
    };
  }

  /**
   * Search for tweets with media
   */
  searchMedia(query: string, limit: number = 20): SearchResult<ParsedTweet> {
    const parsedQuery = this.parser.parseQuery(query);

    let tweetIds = new Set<string>();

    // Start with media tweets only
    const mediaTweetIds = this.indexer.getMediaTweets();

    if (parsedQuery.tokens.length > 0) {
      const searchResults = this.indexer.searchTweets(parsedQuery.tokens);
      // Intersection: tweets that match query AND have media
      searchResults.forEach((id) => {
        if (mediaTweetIds.has(id)) {
          tweetIds.add(id);
        }
      });
    } else {
      // If no query, return all media tweets
      tweetIds = mediaTweetIds;
    }

    // Add hashtag results (that also have media)
    parsedQuery.hashtags.forEach((hashtag) => {
      const hashtagResults = this.indexer.searchByHashtag(hashtag);
      hashtagResults.forEach((id) => {
        if (mediaTweetIds.has(id)) {
          tweetIds.add(id);
        }
      });
    });

    // Sort by score (engagement)
    const tweets = this.indexer
      .getTweets(Array.from(tweetIds))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      data: tweets,
      total: tweetIds.size,
    };
  }

  /**
   * Get index statistics
   */
  getStats() {
    return this.indexer.getStats();
  }

  /**
   * Save index to persistence
   */
  async saveIndex(key: string = "search_index"): Promise<void> {
    const indexDoc = this.indexer.exportIndex();
    await this.persistence.saveIndex(key, indexDoc);

    const metadata = {
      lastUpdated: new Date().toISOString(),
      stats: this.getStats(),
    };
    await this.persistence.saveIndexMetadata(key, metadata);
  }

  /**
   * Load index from persistence
   */
  async loadIndex(key: string = "search_index"): Promise<boolean> {
    const indexDoc = await this.persistence.loadIndex(key);
    if (!indexDoc) return false;

    this.indexer.importIndex(indexDoc);
    return true;
  }
}