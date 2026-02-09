import { Helmet } from 'react-helmet';

const SEO = ({
  title = 'PlaceIntern - College Internship Management Portal',
  description = 'Internship Management Portal for PSBTE - Punjab State Board of Technical Education. Comprehensive platform for managing student internships, mentor assignments, and institutional coordination',
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