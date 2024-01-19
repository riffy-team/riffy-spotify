const { fetch } = require("undici");
const { Plugin, Track } = require("riffy");

const REGEX = /(?:https:\/\/open\.spotify\.com\/|spotify:)(.+)(?:[\/:])([A-Za-z0-9]+)/;

class Spotify extends Plugin {
    constructor(options) {
        super();
        this.baseURL = 'https://api.spotify.com/v1';
        this.token = '';
        this.options = options;
        this.authorization = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64');
        this.interval = 0;

        this.functions = {
            track: this.getTrack.bind(this),
            album: this.getAlbum.bind(this),
            playlist: this.getPlaylist.bind(this)
        }

        this.renew();
    }

    async load(riffy) {
        this.riffy = riffy;
        this._resolve = riffy.resolve.bind(riffy);
        riffy.resolve = this.resolve.bind(this);
    }

    check(query) {
        return REGEX.test(query);
    }

    async resolve({ query, requester }) {
        let trackLoaded = "",
            playlistLoaded = "",
            loadFailed = "";

        const node = this.riffy.leastUsedNodes[0];
        
        if (node.restVersion === "v4") {
            trackLoaded = "track";
            playlistLoaded = "playlist";
            loadFailed = "error";
        } else {
            trackLoaded = "TRACK_LOADED";
            playlistLoaded = "PLAYLIST_LOADED";
            loadFailed = "LOAD_FAILED";
        }

        if (!this.token) await this.requestToken();
        const finalQuery = query.query || query;
        const [, type, id] = finalQuery.match(REGEX) || [];

        if (type in this.functions) {
            try {
                const func = this.functions[type];

                if (!func) {
                    throw new Error('Incorrect type for Spotify URL, must be one of "track", "album" or "playlist".');
                }

                const data = await func(id);
                const loadType = type === "track" ? trackLoaded : playlistLoaded;
                const name = ["playlist", "album"].includes(type) ? data.name : null;

                const tracks = await Promise.all(data.tracks.map(async query => {
                    const track = await this.buildUnresolved(query, requester);
                    return track;
                }));

                return this.buildResponse(loadType, tracks, name, null);
            } catch (e) {
                return this.buildResponse(e.loadType || loadFailed, null, null, e.message || null);
            }
        }

        return this._resolve({ query, requester });
    }

    async getTrack(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/tracks/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        return {
            tracks: [{
                id: data.id,
                title: data.name,
                author: data.artists[0].name,
                duration: data.duration_ms
            }]
        }
    }

    async getAlbum(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/albums/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        return {
            name: data.name,
            tracks: data.tracks.items.map(tracks => ({
                id: tracks.id,
                title: tracks.name,
                author: tracks.artists[0].name,
                duration: tracks.duration_ms
            }))
        }
    }

    async getPlaylist(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/playlists/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        return {
            name: data.name,
            tracks: data.tracks.items.map(tracks => ({
                id: tracks.track.id,
                title: tracks.track.name,
                author: tracks.track.artists[0].name,
                duration: tracks.track.duration_ms
            }))
        }
    }

    async requestToken() {
        try {
            const requestBody = new URLSearchParams();
            requestBody.append('grant_type', 'client_credentials');
            requestBody.append('client_id', this.options.clientId);
            requestBody.append('client_secret', this.options.clientSecret);

            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: requestBody,
            };

            const res = await fetch("https://accounts.spotify.com/api/token", requestOptions).then(async res => await res.json())

            this.token = res.access_token;
            this.interval = res.expires_in * 1000;
        } catch (e) {
            if (e.status === 400) {
                throw new Error('The client ID or client secret is incorrect.');
            }
        }
    }

    async renew() {
        await this.requestToken();
        setTimeout(() => this.renew(), this.interval);
    }

    async buildUnresolved(track, requester) {
        if (!track) throw new ReferenceError('The Spotify track object was not provided');

        const node = this.riffy.leastUsedNodes[0];

        return new Track(
          {
            track: "",
            info: {
              identifier: track.id,
              isSeekable: true,
              author: track.author || "Unknown",
              length: track.duration,
              isStream: false,
              sourceName: "spotify",
              title: track.title,
              uri: `https://open.spotify.com/track/${track.id}`,
              thumbnail: null,
              position: 0,
            },
          },
          requester,
          node
        );
    }

    async buildResponse(loadType, tracks, name, error) {
        return Object.assign(
            {
                loadType,
                tracks,
                playlistInfo: name ? {
                    name
                } : null,
                exception: error ? {
                    message: error,
                    severity: 'COMMON',
                } : null
            }
        )
    }
}

module.exports = { Spotify };