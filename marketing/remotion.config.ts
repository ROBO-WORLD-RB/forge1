/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

/** PNG frames stay sharper than JPEG for type-heavy motion graphics. */
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
/** Lower CRF = higher quality (x264). 16 is crisp for phone reels. */
Config.setCrf(16);
Config.overrideWebpackConfig(enableTailwind);
