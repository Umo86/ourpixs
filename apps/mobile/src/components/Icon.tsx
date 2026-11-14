import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Lucide-style 24px stroke icons (stroke 2). Decorative: give the wrapping control the accessibility label. */
const PATHS = {
  camera: ["M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z", "c:12,13,3"],
  image: ["r:3,3,18,18,2", "c:9,9,2", "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"],
  upload: ["M12 3v12", "m17 8-5-5-5 5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
  qr: ["r:3,3,7,7,1", "r:14,3,7,7,1", "r:3,14,7,7,1", "M14 14h3v3h-3z", "M20 14v.01", "M14 20h.01", "M17 20h4v-3", "M20 17v.01"],
  book: ["M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"],
  target: ["c:12,12,10", "c:12,12,6", "c:12,12,2"],
  settings: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "c:12,12,3"],
  tv: ["r:2,7,20,15,2", "m17 2-5 5-5-5"],
  heart: ["M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"],
  star: ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"],
  eye: ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z", "c:12,12,3"],
  eyeOff: ["M9.88 9.88a3 3 0 1 0 4.24 4.24", "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68", "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61", "M2 2l20 20"],
  trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  chevronLeft: ["m15 18-6-6 6-6"],
  chevronRight: ["m9 18 6-6-6-6"],
  plus: ["M12 5v14", "M5 12h14"],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "m16 6-4-4-4 4", "M12 2v13"],
  printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v8H6z"],
  download: ["M12 4v12", "M7 11l5 5 5-5", "M4 20h16"],
  globe: ["c:12,12,10", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  logOut: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  mail: ["r:2,4,20,16,2", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  play: ["m6 3 14 9-14 9V3z"],
  pause: ["M6 4h4v16H6z", "M14 4h4v16h-4z"],
  mic: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  video: ["m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5", "r:2,6,14,12,2"],
  link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  copy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  lock: ["r:3,11,18,11,2", "M7 11V7a5 5 0 0 1 10 0v4"],
  clock: ["c:12,12,10", "M12 6v6l4 2"],
  calendar: ["r:3,4,18,18,2", "M16 2v4", "M8 2v4", "M3 10h18"],
  mapPin: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "c:12,10,3"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "c:9,7,4", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"],
  sparkles: ["M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"],
  refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  flip: ["M3 12a9 9 0 0 1 15-6.7L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15 6.7L3 16", "M3 21v-5h5"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  message: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  checkCircle: ["c:12,12,10", "m9 12 2 2 4-4"],
  alert: ["c:12,12,10", "M12 8v4", "M12 16h.01"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  home: ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color = "currentColor", strokeWidth = 2, fill = "none" }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessible={false} pointerEvents="none">
      {PATHS[name].map((d, i) => {
        if (d.startsWith("c:")) {
          const [cx, cy, r] = d.slice(2).split(",").map(Number);
          return <Circle key={i} cx={cx} cy={cy} r={r} fill={fill === "none" ? "none" : fill} />;
        }
        if (d.startsWith("r:")) {
          const [x, y, w, h, rx] = d.slice(2).split(",").map(Number);
          return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx} fill="none" />;
        }
        return <Path key={i} d={d} fill={fill} />;
      })}
    </Svg>
  );
}
