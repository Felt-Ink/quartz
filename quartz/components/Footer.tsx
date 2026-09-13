import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"

interface Options {
  links: Record<string, string>
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const links = Object.entries(opts?.links ?? {})
    return (
      <footer class={`${displayClass ?? ""}`}>
        <p>
          Created with <a href="https://felt.ink">Felt</a>
        </p>
        {links.length > 0 && (
          <ul>
            {links.map(([text, link]) => (
              <li>
                <a href={link}>{text}</a>
              </li>
            ))}
          </ul>
        )}
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
