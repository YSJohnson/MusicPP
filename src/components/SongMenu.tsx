import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../store/player';
import { useSongMenu } from '../store/songMenu';
import { useToast } from '../store/toast';
import { Cover } from './Cover';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export function SongMenu() {
  const { song, close } = useSongMenu();
  const navigate = useNavigate();
  const playSong = usePlayer((s) => s.playSong);
  const insertNext = usePlayer((s) => s.insertNext);
  const appendQueue = usePlayer((s) => s.appendQueue);
  const toast = useToast((s) => s.show);

  return (
    <Sheet open={!!song} title="歌曲操作" onClose={close}>
      {song && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '4px 14px 14px',
            }}
          >
            <Cover
              src={song.cover}
              alt={song.name}
              size={220}
              className="song-cover"
              iconSize={18}
            />
            <div style={{ minWidth: 0 }}>
              <div className="h3 ellipsis">{song.name}</div>
              <div className="dim ellipsis" style={{ fontSize: 11.5, marginTop: 4 }}>
                {song.artist}
                {song.album ? ` · ${song.album}` : ''}
              </div>
            </div>
          </div>

          <MenuButton
            icon="play"
            label="立即播放"
            onClick={() => {
              close();
              void playSong(song, [song], '单曲播放');
            }}
          />
          <MenuButton
            icon="queue"
            label="下一首播放"
            onClick={() => {
              close();
              insertNext(song);
              toast('已设为下一首播放', 'success');
            }}
          />
          <MenuButton
            icon="plus"
            label="加入播放列表"
            onClick={() => {
              close();
              appendQueue([song]);
            }}
          />
          {song.artistId && (
            <MenuButton
              icon="user"
              label="查看歌手"
              onClick={() => {
                close();
                navigate(`/artist/${song.artistId}`);
              }}
            />
          )}
          {song.albumId && (
            <MenuButton
              icon="disc"
              label="查看专辑"
              onClick={() => {
                close();
                navigate(`/album/${song.albumId}`);
              }}
            />
          )}
          <MenuButton
            icon="share"
            label="复制歌曲信息"
            onClick={async () => {
              const text = `${song.name} - ${song.artist}`;
              try {
                await navigator.clipboard.writeText(text);
                toast('已复制', 'success');
              } catch {
                toast(text, 'info');
              }
              close();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="quality-row" onClick={onClick}>
      <span className="q">
        <Icon name={icon} size={18} />
        {label}
      </span>
      <Icon name="chevronRight" size={15} className="dim" />
    </button>
  );
}
