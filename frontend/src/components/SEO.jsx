import { Helmet } from 'react-helmet';

const SEO = ({
  title = 'College Management System',
  description = 'Comprehensive internship and college management platform',
}) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#3b82f6" />
    <link rel="canonical" href={window.location.href} />
  </Helmet>
);

export default SEO;