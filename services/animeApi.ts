const ANILIST_API_URL = 'https://graphql.anilist.co';

export interface AnimeQueryParams {
  search?: string;
  genres?: string[];
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

const ANIME_SEARCH_QUERY = `
  query ($search: String, $genres: [String], $status: MediaStatus, $sort: [MediaSort], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, genre_in: $genres, status: $status, sort: $sort, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          color
        }
        bannerImage
        averageScore
        status
        episodes
        duration
        genres
        studios(isMain: true) {
          nodes {
            name
          }
        }
      }
    }
  }
`;

export async function fetchAnimeData(params: AnimeQueryParams) {
  const variables: Record<string, any> = {
    page: params.page || 1,
    perPage: params.perPage || 20,
    sort: params.sort ? [params.sort] : ['POPULARITY_DESC'],
  };

  if (params.search) variables.search = params.search;
  if (params.genres && params.genres.length > 0) variables.genres = params.genres;
  if (params.status) variables.status = params.status.toUpperCase();

  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: ANIME_SEARCH_QUERY,
        variables,
      }),
      next: { revalidate: 3600 },
    });

    const json = await response.json();
    if (json.errors) {
      console.error('AniList GraphQL Errors:', json.errors);
      throw new Error('Failed to fetch anime data');
    }

    return json.data.Page;
  } catch (error) {
    console.error('API Error:', error);
    return { media: [], pageInfo: { hasNextPage: false } };
  }
}
