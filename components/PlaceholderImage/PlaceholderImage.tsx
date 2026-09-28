import Image from "next/image";

type PlaceholderImageProps = {
  width: number;
  height: number;
  alt: string;
  className?: string;
};

/**
 * Imagem provisória no tamanho definido pelo design.
 * Será substituída pelos assets finais.
 */
export function PlaceholderImage({ width, height, alt, className }: PlaceholderImageProps) {
  return (
    <Image
      src={`https://placehold.co/${width}x${height}`}
      width={width}
      height={height}
      alt={alt}
      className={className}
      unoptimized
    />
  );
}
