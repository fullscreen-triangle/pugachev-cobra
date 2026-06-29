import { Config } from '@remotion/cli/config';
import path from 'path';

Config.setEntryPoint('./remotion/index.ts');
Config.setPublicDir('./assets');

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        // @/ maps to web/src/ — matches the Next.js tsconfig paths
        '@': path.resolve(process.cwd(), 'web/src'),
      },
    },
  };
});
