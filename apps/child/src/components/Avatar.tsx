import type { Child } from "../types";

const AVATAR_EMOJIS = ["🦁", "🐯", "🦊", "🐼", "🐨", "🐵", "🐸", "🐧", "🦄", "🐤", "🐙", "🦋"];

const AVATAR_COLORS = [
  "#ffe0b2",
  "#b2dfdb",
  "#c5cae9",
  "#f8bbd0",
  "#d1c4e9",
  "#ffccbc",
  "#dcedc8",
  "#b2ebf2",
];

export function avatarForName(name: string): { emoji: string; color: string } {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  const seed = Math.abs(hash);
  return {
    emoji: AVATAR_EMOJIS[seed % AVATAR_EMOJIS.length],
    color: AVATAR_COLORS[seed % AVATAR_COLORS.length],
  };
}

interface AvatarProps {
  child: Child;
}

export function Avatar({ child }: AvatarProps) {
  if (child.avatarUrl !== null) {
    return <img className="avatar avatar-photo" src={child.avatarUrl} alt={child.fullName} />;
  }
  const { emoji, color } = avatarForName(child.fullName);
  return (
    <div className="avatar" style={{ backgroundColor: color }} aria-hidden="true">
      {emoji}
    </div>
  );
}
