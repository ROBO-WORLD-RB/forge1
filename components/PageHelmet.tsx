import { Helmet } from 'react-helmet-async';

interface PageHelmetProps {
  title: string;
  description?: string;
  path?: string;
}

const SITE_NAME = 'FORGE - Blue-Collar Marketplace';
const DEFAULT_DESCRIPTION = 'Find verified electricians, plumbers, caterers, and more in Ghana and Nigeria. Pay on booking with funds held until work is done, AI price insights, and instant booking.';
const BASE_URL = 'https://forge.app';

const PageHelmet: React.FC<PageHelmetProps> = ({ title, description, path }) => {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = path ? `${BASE_URL}${path}` : BASE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

export default PageHelmet;
