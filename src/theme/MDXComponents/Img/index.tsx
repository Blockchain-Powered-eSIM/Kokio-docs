import React, { type ComponentProps, type ReactNode } from "react";
import Img from "@theme-original/MDXComponents/Img";

import ImageViewer from "@site/src/components/ImageViewer";

type Props = ComponentProps<"img">;

// Every image in a doc page opens full screen on click. Diagrams are drawn at
// several thousand pixels wide and are unreadable at column width.
export default function ImgWrapper(props: Props): ReactNode {
  if (!props.src) return <Img {...props} />;

  return (
    <ImageViewer src={props.src} alt={props.alt ?? ""}>
      <Img {...props} />
    </ImageViewer>
  );
}
