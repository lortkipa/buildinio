import Image from "next/image";

/** A user's round picture: from Google or GitHub, uploaded in the settings, or the default one. */
export function Avatar({ src, size, className = "" }: { src: string; size: number; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized // Small pictures from Google, GitHub, an upload or our own SVG: nothing to gain.
      referrerPolicy="no-referrer" // Google's picture links can refuse requests from other sites.
      className={`shrink-0 rounded-full bg-border object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
