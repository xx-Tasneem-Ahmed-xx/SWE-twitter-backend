import { PeopleFilter } from "@/application/dtos/tweets/tweet.dto.schema";

export type SearchParams = {
  userId: string;
  peopleFilter: PeopleFilter;
  limit: number;
  query: string;
  cursor?: { id: string };
};
