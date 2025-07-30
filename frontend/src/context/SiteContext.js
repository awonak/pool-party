import { createContext, useContext } from 'react';

/**
 * Context for providing site-wide configuration, like title and headline.
 * It's initialized with null and will be provided a value in App.js.
 */
const SiteContext = createContext(null);

/**
 * Custom hook to easily access the site configuration from the context.
 * This simplifies consumption in components and can add validation.
 * @returns {object} The site configuration object.
 */
export const useSiteConfig = () => {
    return useContext(SiteContext);
};

export default SiteContext;