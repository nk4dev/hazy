import { Layers } from "lucide-react";

/**
 * A thumbnail for a collection built from the og:image URLs of the links
 * saved inside it. Falls back to an icon when none of the items have an
 * image yet. 1 image fills the frame; 2–4 tile into a mosaic.
 */
export function CollectionPreview({ images, name }: { images: string[]; name: string }) {
  const shots = images.slice(0, 4);

  if (shots.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center bg-secondary">
        <Layers className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (shots.length === 1) {
    return (
      <div className="aspect-[16/10] w-full overflow-hidden bg-secondary">
        <Shot src={shots[0]} name={name} />
      </div>
    );
  }

  return (
    <div className="grid aspect-[16/10] w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-secondary">
      {shots.map((src, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: og:image URLs can repeat across items; tile position is the stable identity
          key={`${index}-${src}`}
          className={
            shots.length === 2
              ? "row-span-2 overflow-hidden"
              : shots.length === 3 && index === 0
                ? "col-span-2 overflow-hidden"
                : "overflow-hidden"
          }
        >
          <Shot src={src} name={name} />
        </div>
      ))}
    </div>
  );
}

function Shot({ src, name }: { src: string; name: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: arbitrary external OG image, not worth next/image's overhead
    <img
      src={src}
      alt={`${name} preview`}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}
