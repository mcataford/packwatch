# Best Practices: tips and tricks to use Packwatch to its fullest

## Overview

Monitoring the footprint of the packages you publish can be a powerful first step towards being producing efficient, trim code that doesn't use more resources that it should and that is a no-brainer to adopt. This document compiles some suggestions on how to get the most out of packwatch for your project.

### Understanding `.packwatch.json`

The `.packwatch.json` file persisted in your project keeps track of the last reported package size that was commited to your version control system. At the moment, it consists of three keys:

- `packageSize`, representing the size of your package's archive as it is when packed using `npm pack`;
- `unpackedSize`, representing the _unpacked_ size of that package (i.e. once installed, what space do the published filed occupy on disk);
- `limit`, representing a threshold that will cause Packwatch to throw an error if crossed.

While the `packageSize` and `unpackedSize` are automatically populated when you update Packwatch's manifest, the `limit` value can be set manually so that you leave yourself some "head room" for growth.

#### Setting sensible thresholds

When Packwatch initializes its manifest, it will initialize the `limit` parameter to be equal to `packedSize` so that any increase in size will cause a failure. Once you determine what kind of growth you want to allow for, you can edit the manifest to increase the limit. Any automatic updates to the manifest will leave the `limit` value as-is.

Setting a sensible limit is essential to avoiding "packwatch fatigue", a scenario in which packwatch fails every time your package size grows because the `limit` parameter is too close to the `packageSize` value. Usually, having a limit that is more or less 5 kB above the `packageSize` will allow for growth while still preventing bloat to sneak it. From there, you can readjust the `limit` value as your project grows so that the "head room" space between `packageSize` and `limit` stays adequate.

### Integrating Packwatch into your workflow

In order to monitor your project's growth accurately, it's preferrable to have Packwatch run both in your pre-commit hooks and CI pipeline. This way, you can catch bloat before commits are event pushed up and you can get another chance to catch undesired overgrowth before you merge in change bundles.
