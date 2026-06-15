import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

const ALBUMS = [
  { id: "01", meta: "Portraits",   title: "Green Turban",       href: "/playground" },
  { id: "02", meta: "Love Story",  title: "Golden Feelings",    href: "/playground" },
  { id: "03", meta: "Children",    title: "Little Lady",        href: "/playground" },
  { id: "04", meta: "Wedding",     title: "Sweet Harmony",      href: "/playground" },
  { id: "05", meta: "Portraits",   title: "Holiday Makeup",     href: "/playground" },
  { id: "06", meta: "Wedding",     title: "The Big Day",        href: "/playground" },
  { id: "07", meta: "Love Story",  title: "When You Love",      href: "/playground" },
  { id: "08", meta: "Children",    title: "Walking by Ocean",   href: "/playground" },
  { id: "09", meta: "Portraits",   title: "Beauty of the Wild", href: "/playground" },
  { id: "10", meta: "Children",    title: "Kids Happiness",     href: "/playground" },
  { id: "11", meta: "Love Story",  title: "Día de Los Muertos", href: "/playground" },
  { id: "12", meta: "Children",    title: "Share Your Smile",   href: "/playground" },
  { id: "13", meta: "Wedding",     title: "From Now and Ever",  href: "/playground" },
  { id: "14", meta: "Children",    title: "Autumn Gladness",    href: "/playground" },
  { id: "15", meta: "Wedding",     title: "Wedding Day",        href: "/playground" },
  { id: "16", meta: "Portraits",   title: "Smiling Beauty",     href: "/playground" },
  { id: "17", meta: "Love Story",  title: "Underwater Love",    href: "/playground" },
  { id: "18", meta: "Portraits",   title: "Bright Life Colors", href: "/playground" },
];

const NAV_LINKS = [
  { href: "/",           label: "Home" },
  { href: "/playground", label: "Playground" },
  { href: "/projects",   label: "Projects" },
  { href: "/articles",   label: "Articles" },
];

const ITEM_VW = 50;
const PAD_LEFT_VW = 25;

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(0);

  const itemWidthPx = useCallback(() => (window.innerWidth * ITEM_VW) / 100, []);
  const padLeftPx   = useCallback(() => (window.innerWidth * PAD_LEFT_VW) / 100, []);

  const snapTo = useCallback((idx, instant = false) => {
    const clamped = Math.max(0, Math.min(idx, ALBUMS.length - 1));
    const iw = itemWidthPx();
    const pl = padLeftPx();
    const target = -(clamped * iw) + (window.innerWidth / 2 - iw / 2 - pl);
    if (instant) {
      x.set(target);
    } else {
      animate(x, target, { type: "spring", stiffness: 300, damping: 40 });
    }
    setActiveIdx(clamped);
  }, [x, itemWidthPx, padLeftPx]);

  useEffect(() => { snapTo(0, true); }, []); // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") snapTo(activeIdx + 1);
      if (e.key === "ArrowLeft")  snapTo(activeIdx - 1);
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIdx, snapTo]);

  const onPointerDown = (e) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startVal.current = x.get();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDragging.current) return;
    x.set(startVal.current + (e.clientX - startX.current));
  };

  const onPointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.clientX - startX.current;
    const moved = Math.round(-delta / itemWidthPx());
    snapTo(activeIdx + moved);
  };

  return (
    <>
      <Head>
        <title>MEE — Media Effect Encoder</title>
        <meta
          name="description"
          content="A domain-specific language that compiles behavioural effect descriptions into Remotion video compositions."
        />
      </Head>

      <div className="anita-root">

        {/* Background slides */}
        <div className="anita-bg" aria-hidden="true">
          {ALBUMS.map((album, i) => (
            <div key={album.id} className={`anita-bg-slide${i === activeIdx ? " is-active" : ""}`}>
              <Image
                src={`/albums/album${album.id}.jpg`}
                alt=""
                fill
                sizes="100vw"
                style={{ objectFit: "cover" }}
                priority={i < 2}
              />
            </div>
          ))}
          <div className="anita-overlay" />
        </div>

        {/* Header */}
        <header className="anita-header">
          <div className="anita-header-inner">
            <div className="anita-logo-wrapper">
              <Link href="/" className="anita-logo">
                <Image
                  src="/logo.png"
                  alt="MEE"
                  width={192}
                  height={80}
                  style={{ width: "auto", height: "auto", maxWidth: 140 }}
                  priority
                />
              </Link>
            </div>
            <div className="anita-menu-wrapper">
              <button
                className={`anita-menu-toggler${menuOpen ? " is-open" : ""}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
              >
                <i className="anita-menu-toggler-icon" />
              </button>
            </div>
          </div>
        </header>

        {/* Fullscreen overlay menu */}
        <motion.div
          className="anita-fullscreen-menu-wrap"
          initial={false}
          animate={{ opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? "all" : "none" }}
          transition={{ duration: 0.4 }}
        >
          <motion.nav
            className="anita-nav"
            animate={{ scale: menuOpen ? 1 : 0.85 }}
            transition={{ duration: 0.4 }}
          >
            <ul className="anita-nav-list">
              {NAV_LINKS.map((link, i) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={() => setMenuOpen(false)}>
                    <sup>0{i + 1}.</sup>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        </motion.div>

        {/* Main */}
        <main className="anita-main">
          <div
            className="anita-gl-carousel-gallery-wrap"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <motion.div className="anita-gl-carousel-gallery" style={{ x }}>
              {ALBUMS.map((album, i) => (
                <div
                  key={album.id}
                  className={`anita-gl-gallery-item${i === activeIdx ? " is-active" : ""}`}
                  onClick={() => { if (i !== activeIdx) snapTo(i); }}
                >
                  <div className="anita-gl-gallery-item__content">
                    <span className="anita-gl-gallery__meta">{album.meta}</span>
                    <h2 className="anita-gl-gallery__caption">
                      <sup>{album.id}.</sup>{album.title}
                    </h2>
                    <span className="anita-gl-gallery__explore">Explore</span>
                    {i === activeIdx && (
                      <Link
                        href={album.href}
                        className="anita-album-link"
                        aria-label={`View ${album.title}`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </motion.div>

            <button
              className="anita-gallery-nav anita-gallery-nav__prev"
              onClick={() => snapTo(activeIdx - 1)}
              disabled={activeIdx === 0}
              aria-label="Previous work"
            >
              <span>Previous Work</span>
            </button>
            <button
              className="anita-gallery-nav anita-gallery-nav__next"
              onClick={() => snapTo(activeIdx + 1)}
              disabled={activeIdx === ALBUMS.length - 1}
              aria-label="Next work"
            >
              <span>Next Work</span>
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="anita-footer">
          <div className="anita-footer-inner">
            <div className="anita-copyright">© 2025 MEE — Media Effect Encoder</div>
            <ul className="anita-socials-list">
              <li><a href="#" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a href="#" target="_blank" rel="noopener noreferrer">Twitter</a></li>
            </ul>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        :root {
          --anita-s-bg-body:      #0E0E10;
          --anita-s-heading:      #E6E6E6;
          --anita-s-content:      #A6A6A6;
          --anita-s-meta:         rgba(230,230,230,0.75);
          --anita-t-heading-ff:   'Rajdhani', sans-serif;
          --anita-t-content-ff:   'Open Sans', sans-serif;
          --anita-t-caption-fs:   64px;
          --anita-t-meta-fs:      14px;
          --anita-t-footer-fs:    14px;
          --anita-t-menu-fs:      64px;
          --anita-t-heading-fw:   700;
        }
        @media (max-width: 1366px) {
          :root { --anita-t-caption-fs: 48px; --anita-t-menu-fs: 48px; }
        }
        @media (max-width: 1200px) {
          :root { --anita-t-caption-fs: 40px; --anita-t-menu-fs: 40px; }
        }
        @media (max-width: 960px)  {
          :root { --anita-t-caption-fs: 40px; --anita-t-menu-fs: 32px; }
        }
        @media (max-width: 739px)  {
          :root { --anita-t-caption-fs: 32px; }
        }

        /* Root shell */
        .anita-root {
          position: fixed;
          inset: 0;
          background: var(--anita-s-bg-body);
          font-family: var(--anita-t-content-ff);
          color: var(--anita-s-content);
          overflow: hidden;
          -webkit-user-select: none;
          user-select: none;
        }

        /* BG */
        .anita-bg { position: absolute; inset: 0; z-index: 0; }
        .anita-bg-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 0.8s ease; }
        .anita-bg-slide.is-active { opacity: 1; }
        .anita-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(0deg, #000000c0 0%, #00000080 25%, #00000040 55%, transparent 100%);
          z-index: 1;
        }

        /* Header */
        .anita-header {
          position: absolute; top: 0; left: 0; width: 100%;
          z-index: 111; pointer-events: none;
        }
        .anita-header-inner {
          padding: 40px 50px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        @media (max-width: 739px) { .anita-header-inner { padding: 20px; } }
        .anita-logo-wrapper, .anita-menu-wrapper { pointer-events: all; }
        .anita-logo { display: block; }

        /* Toggler */
        .anita-menu-toggler {
          width: 44px; height: 44px;
          background: none; border: none; cursor: pointer; padding: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .anita-menu-toggler-icon {
          display: block; width: 32px; height: 14px; position: relative;
        }
        .anita-menu-toggler-icon::before,
        .anita-menu-toggler-icon::after {
          content: ''; display: block;
          background: var(--anita-s-heading);
          height: 3px; border-radius: 2px;
          position: absolute;
          transition: transform 0.3s;
        }
        .anita-menu-toggler-icon::before { width: 100%; left: 0; top: 0; }
        .anita-menu-toggler-icon::after  { width: 28px; right: 0; bottom: 0; }
        .anita-menu-toggler.is-open .anita-menu-toggler-icon::before {
          transform: translate(5px, -6px) rotate(45deg);
        }
        .anita-menu-toggler.is-open .anita-menu-toggler-icon::after {
          transform: translate(1px, 5px) rotate(-45deg) scale(1.14, 1);
        }

        /* Fullscreen menu */
        .anita-fullscreen-menu-wrap {
          position: fixed; inset: 0; z-index: 101;
          display: flex; align-items: center; justify-content: center;
          background: var(--anita-s-bg-body);
          overflow: hidden;
        }
        .anita-nav {
          padding: 80px 40px;
          overflow-y: auto; scrollbar-width: none; max-height: 100vh;
        }
        .anita-nav::-webkit-scrollbar { width: 0; }
        .anita-nav-list { list-style: none; margin: 0; padding: 0; }
        .anita-nav-list li { margin-bottom: 26px; }
        .anita-nav-list li a {
          font-family: var(--anita-t-heading-ff);
          font-weight: var(--anita-t-heading-fw);
          font-size: var(--anita-t-menu-fs);
          line-height: 1.2em;
          color: var(--anita-s-heading);
          text-decoration: none;
          display: block;
          transition: opacity 0.3s;
        }
        .anita-nav-list li a:hover { opacity: 0.65; }
        .anita-nav-list li a sup {
          margin-right: 14px;
          opacity: 0.25;
          font-size: 0.45em;
          vertical-align: super;
        }

        /* Main */
        .anita-main { position: absolute; inset: 0; z-index: 4; }

        /* Carousel wrapper */
        .anita-gl-carousel-gallery-wrap {
          position: absolute; inset: 0;
          overflow: hidden;
          touch-action: pan-y;
          cursor: grab;
        }
        .anita-gl-carousel-gallery-wrap:active { cursor: grabbing; }

        /* Carousel strip */
        .anita-gl-carousel-gallery {
          position: absolute; top: 0; height: 100%;
          display: flex; flex-wrap: nowrap;
          padding-left: 25vw;
          will-change: transform;
        }
        @media (max-width: 739px) {
          .anita-gl-carousel-gallery { padding-left: 0; }
        }

        /* Gallery item */
        .anita-gl-gallery-item {
          width: 50vw; flex-shrink: 0; height: 100%;
          display: flex; justify-content: center; align-items: flex-end;
          padding-bottom: 120px;
          opacity: 0.35;
          transition: opacity 0.5s;
          cursor: pointer;
        }
        .anita-gl-gallery-item.is-active {
          opacity: 1;
          cursor: default;
        }
        @media (max-width: 739px) {
          .anita-gl-gallery-item { width: 100vw; padding-bottom: 80px; }
        }

        /* Item content */
        .anita-gl-gallery-item__content { position: relative; text-align: center; }
        .anita-album-link {
          position: absolute; inset: -24px;
          display: block;
        }

        /* Meta */
        .anita-gl-gallery__meta {
          display: block;
          font-family: var(--anita-t-content-ff);
          font-size: var(--anita-t-meta-fs);
          color: var(--anita-s-heading);
          opacity: 0.75;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        /* Caption */
        .anita-gl-gallery__caption {
          display: block;
          font-family: var(--anita-t-heading-ff);
          font-weight: var(--anita-t-heading-fw);
          font-size: var(--anita-t-caption-fs);
          line-height: 1;
          color: var(--anita-s-heading);
          margin: 0 0 4px;
          text-shadow: 0 0 12px rgba(0,0,0,0.5);
          white-space: nowrap;
        }
        .anita-gl-gallery__caption sup {
          margin-right: 6px;
          opacity: 0.25;
          font-size: 0.45em;
          vertical-align: super;
        }

        /* Explore */
        .anita-gl-gallery__explore {
          display: block;
          font-family: var(--anita-t-content-ff);
          font-size: var(--anita-t-meta-fs);
          color: var(--anita-s-heading);
          opacity: 0;
          transition: opacity 0.5s;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 8px;
          text-align: right;
        }
        .anita-gl-gallery-item.is-active .anita-gl-gallery__explore { opacity: 0.75; }

        /* Nav buttons */
        .anita-gallery-nav {
          width: 56px; height: 56px;
          border-radius: 50%;
          border: 2px solid var(--anita-s-heading);
          background: rgba(0,0,0,0.25);
          color: var(--anita-s-heading);
          display: flex; align-items: center; justify-content: center;
          position: absolute;
          top: 50%; transform: translateY(-50%);
          z-index: 7; cursor: pointer;
          opacity: 0.65;
          transition: opacity 0.3s;
          font-size: 20px;
        }
        .anita-gallery-nav:hover:not(:disabled) { opacity: 1; }
        .anita-gallery-nav:disabled { opacity: 0.2; cursor: default; }
        .anita-gallery-nav__prev { left: 50px; }
        .anita-gallery-nav__next { right: 50px; }
        .anita-gallery-nav__prev::before { content: '←'; }
        .anita-gallery-nav__next::before { content: '→'; }
        .anita-gallery-nav span {
          position: absolute;
          white-space: nowrap;
          font-family: var(--anita-t-content-ff);
          font-size: 12px;
          color: var(--anita-s-heading);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
          text-shadow: 0 0 8px rgba(0,0,0,0.5);
        }
        .anita-gallery-nav__prev span { left: 100%; padding-left: 14px; }
        .anita-gallery-nav__next span { right: 100%; padding-right: 14px; }
        .anita-gallery-nav:hover:not(:disabled) span { opacity: 1; }
        @media (max-width: 739px) {
          .anita-gallery-nav__prev { left: 16px; }
          .anita-gallery-nav__next { right: 16px; }
        }

        /* Footer */
        .anita-footer {
          position: absolute; bottom: 0; left: 0; width: 100%;
          z-index: 33; pointer-events: none;
        }
        .anita-footer-inner {
          display: flex; justify-content: space-between; align-items: center;
          padding: 41px 50px;
          font-size: var(--anita-t-footer-fs);
        }
        @media (max-width: 739px) { .anita-footer-inner { padding: 19px 20px; } }
        .anita-copyright { color: var(--anita-s-content); pointer-events: all; }
        .anita-socials-list {
          list-style: none; margin: 0; padding: 0;
          display: flex; gap: 32px;
          pointer-events: all;
        }
        .anita-socials-list a {
          color: var(--anita-s-heading);
          text-decoration: none;
          transition: opacity 0.3s;
        }
        .anita-socials-list a:hover { opacity: 0.65; }
      `}</style>
    </>
  );
}

// Take full control of the page shell — bypass shared Navbar/Footer
Home.getLayout = (page) => page;
