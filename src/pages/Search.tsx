import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHotWords, search } from '../api';
import type { SearchResult } from '../api';
import type { SearchType } from '../api/types';
import { useSettings } from '../store/settings';
import { SongList } from '../components/SongList';
import { PlaylistCard } from '../components/PlaylistCard';
import { AlbumRow, ArtistRow } from '../components/ArtistRow';
import { EmptyState, SkeletonRows } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { useRequest } from '../hooks/useRequest';

const TABS: { key: SearchType; label: string }[] = [
  { key: 'song', label: '单曲' },
  { key: 'special', label: '歌单' },
  { key: 'author', label: '歌手' },
  { key: 'album', label: '专辑' },
];

export function SearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useSettings((s) => s.recentSearches);
  const pushSearch = useSettings((s) => s.pushSearch);
  const clearSearches = useSettings((s) => s.clearSearches);

  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [tab, setTab] = useState<SearchType>('song');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hot = useRequest(getHotWords, []);

  const run = async (kw: string, type: SearchType, pageNum = 1, append = false) => {
    const q = kw.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await search(q, type, pageNum, 30);
      setResult((prev) =>
        append && prev
          ? {
              songs: [...prev.songs, ...res.songs],
              playlists: [...prev.playlists, ...res.playlists],
              artists: [...prev.artists, ...res.artists],
              albums: [...prev.albums, ...res.albums],
              total: res.total,
            }
          : res,
      );
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submitted) void run(submitted, tab, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, tab]);

  const submit = (kw: string) => {
    const q = kw.trim();
    if (!q) return;
    setKeyword(q);
    pushSearch(q);
    if (q === submitted) {
      void run(q, tab, 1, false);
    } else {
      setSubmitted(q);
    }
    inputRef.current?.blur();
  };

  const count = result
    ? tab === 'song'
      ? result.songs.length
      : tab === 'special'
        ? result.playlists.length
        : tab === 'author'
          ? result.artists.length
          : result.albums.length
    : 0;

  return (
    <div className="page">
      <div className="search-bar">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="search-field">
          <Icon name="search" size={17} className="dim" />
          <input
            ref={inputRef}
            value={keyword}
            placeholder="搜索歌曲、歌手、歌单"
            enterKeyHint="search"
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(keyword);
            }}
          />
          {keyword && (
            <button
              className="clear"
              aria-label="清除"
              onClick={() => {
                setKeyword('');
                setSubmitted('');
                setResult(null);
                inputRef.current?.focus();
              }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      </div>

      {!submitted && (
        <div className="fade-enter">
          {recent.length > 0 && (
            <div className="hot-block" style={{ marginTop: 10 }}>
              <div className="history-row" style={{ padding: 0 }}>
                <span className="mini-title">最近搜索</span>
                <button className="dim" style={{ fontSize: 11 }} onClick={clearSearches}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
              <div className="hot-tags">
                {recent.map((w) => (
                  <button key={w} className="hot-tag" onClick={() => submit(w)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hot-block" style={{ marginTop: 24 }}>
            <div className="history-row" style={{ padding: 0 }}>
              <span className="mini-title">热搜榜</span>
              <span className="dim" style={{ fontSize: 10.5 }}>
                实时更新
              </span>
            </div>
            <div className="hot-tags">
              {(hot.data ?? []).slice(0, 18).map((w, i) => (
                <button
                  key={w}
                  className={`hot-tag ${i < 3 ? 'top' : ''}`}
                  onClick={() => submit(w)}
                >
                  <span className="no">{String(i + 1).padStart(2, '0')}</span>
                  {w}
                </button>
              ))}
              {hot.loading &&
                [0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ width: 96, height: 34, borderRadius: 999 }}
                  />
                ))}
            </div>
          </div>

          <div className="search-hint">
            <Icon name="sparkle" size={13} />
            支持搜索歌曲、歌手、专辑与歌单，结果来自酷狗概念版接口
          </div>
        </div>
      )}

      {submitted && (
        <>
          <div className="search-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && !result && <SkeletonRows count={7} />}

          {error && (
            <EmptyState
              icon="wifi"
              text={error}
              action={
                <button className="btn btn-ghost" onClick={() => void run(submitted, tab, 1)}>
                  重新搜索
                </button>
              }
            />
          )}

          {!error && result && count === 0 && !loading && (
            <EmptyState icon="search" text={`没有找到「${submitted}」相关结果`} />
          )}

          {!error && result && tab === 'song' && count > 0 && (
            <SongList songs={result.songs} context={`搜索：${submitted}`} />
          )}

          {!error && result && tab === 'special' && count > 0 && (
            <div className="grid-2" style={{ marginTop: 8 }}>
              {result.playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          )}

          {!error && result && tab === 'author' && count > 0 && (
            <div className="song-list">
              {result.artists.map((a) => (
                <ArtistRow key={a.id} artist={a} onClick={() => navigate(`/artist/${a.id}`)} />
              ))}
            </div>
          )}

          {!error && result && tab === 'album' && count > 0 && (
            <div className="song-list">
              {result.albums.map((a) => (
                <AlbumRow key={a.id} album={a} onClick={() => navigate(`/album/${a.id}`)} />
              ))}
            </div>
          )}

          {!error && result && count > 0 && count < result.total && (
            <button
              className="load-more"
              disabled={loading}
              onClick={() => void run(submitted, tab, page + 1, true)}
            >
              {loading ? '加载中…' : '加载更多'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
