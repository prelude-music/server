/**
 * Basic Spotify API client
 */
class SpotifyApi {
    public constructor(
        private readonly baseUrl: string
    ) {}

    #accessToken: SpotifyApi.AccessToken | null = null;
    private async fetch(path: string, query: Record<string, string>): Promise<{res: Response, json: any}> {
        try {
            if (this.#accessToken === null || this.#accessToken.hasExpired())
                this.#accessToken = await SpotifyApi.AccessToken.get();
            const init: RequestInit = {
                headers: {
                    "Authorization": "Bearer " + this.#accessToken!.token
                }
            };
            const url = new URL(path, this.baseUrl);
            url.search = new URLSearchParams(query).toString();
            const res = await fetch(url.toString(), init);
            return {res, json: await res.json()};
        }
        catch (e) {
            throw new Error("Spotify API call failed", {cause: e});
        }
    }

    public async getArtistImage(artist: string, track?: string): Promise<string | null> {
        try {
            if (track === undefined) {
                const res = await this.fetch("/v1/search", {
                    q: artist,
                    type: "artist",
                    limit: "1",
                    include_external: "audio"
                });
                if (!res.res.ok || res.json.artists.items.length === 0 || res.json.artists.items[0].images.length === 0 || res.json.artists.items[0].name !== artist) return null;
                return res.json.artists.items[0].images.sort((a: any, b: any) => b.width - a.width).find((img: any) => img.width >= 256)?.url ?? res.json.artists.items[0].images[0].url
            }
            else {
                const res = await this.fetch("/v1/search", {
                    q: artist + " " + track,
                    type: "track",
                    limit: "1",
                    include_external: "audio"
                });
                if (!res.res.ok || res.json.tracks.items.length === 0 || res.json.tracks.items[0].artists.length === 0 || res.json.tracks.items[0].artists[0].name !== artist)
                    return await this.getArtistImage(artist);
                const spotifyArtist = await this.getArtist(res.json.tracks.items[0].artists[0].id);
                if (spotifyArtist === null) return null;
                return spotifyArtist.images.sort((a: any, b: any) => b.width - a.width).find((img: any) => img.width >= 256)?.url ?? res.json.artists.items[0].images[0].url;
            }
        }
        catch (e) {
            throw e;
        }
    }

    public async getArtist(id: string): Promise<{images: {url: string, height: number, width: number}[]} | null> {
        try {
            const res = await this.fetch("/v1/artists/" + id, {});
            if (!res.res.ok) return null;
            return res.json;
        }
        catch (e) {
            throw e;
        }
    }
}

namespace SpotifyApi {
    export class AccessToken {
        private constructor(
            public readonly token: string,
            public readonly expiration: Date
        ) {}

        public hasExpired(): boolean {
            return new Date() > this.expiration;
        }

        public static async get(): Promise<AccessToken | null> {
            const res = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player");
            const json = await res.json();
            if (!res.ok) throw new Error("Could not obtain Spotify API access token", {cause: json});
            return new AccessToken(json.accessToken, new Date(Date.now() + json.accessTokenExpirationTimestampMs));
        }
    }
}

export default SpotifyApi;
