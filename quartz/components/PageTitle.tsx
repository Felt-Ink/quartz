import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>
        {typeof title === "object" && title.type === "image" ? (
          <img src={title.src} alt={title.alt} class="page-title-image" />
        ) : (
          title
        )}
      </a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
.page-title-image {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 1;
  min-height: 2rem;
  max-height: 4rem;
  object-fit: cover;
  object-position: left center;
  border-radius: 4px;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
