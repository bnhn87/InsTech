import type { AppProps } from 'next/app';
import Head from 'next/head';

// Global styles can be imported here if desired.

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>InsTech</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}