/*
  HeroUI v3 removed `Spacer` with nothing to replace it. This reproduces the v2
  component exactly, so its 39 call sites can stay as they were rather than each
  becoming a margin on whatever happens to sit next to it -- a rewrite that would
  have touched fourteen layouts to change nothing.

  v2's geometry, from `@heroui/spacer`: a 1px by 1px inline-block whose real size
  is the margin. `x` and `y` index Tailwind's spacing scale, so `y={2}` is a
  0.5rem top margin, and both default to 1.

  Numbers are multiplied out rather than turned into `mt-*` classes, because the
  props accept arbitrary values -- v2 passed anything that was not a scale key
  straight through as a CSS length -- and a class name cannot be built from a
  value that is only known at runtime.
*/
const toLength = (value) => (typeof value === 'number' ? `${value * 0.25}rem` : value);

export default function Spacer({ x = 1, y = 1, className = '', style, ...props }) {
    return (
        <span
            aria-hidden='true'
            className={`w-px h-px inline-block ${className}`}
            style={{ ...style, marginLeft: toLength(x), marginTop: toLength(y) }}
            {...props}
        />
    );
}
