# Providers

Localization providers map local file structure to language groups. By default, it uses top-level
directory elements to do it. For example, the following file structure generates `addon_english.txt`
and `addon_russian.txt`:

```
localization/
├── english/
│   ├── heroes.yml
│   └── items.yml
└── russian.yml
```

## Localization platforms

Managing localizations might be quite burdensome for big projects. Localization platforms help to
manage translations and provide different features, improving translation speed and quality.

First, there are platforms that keep files in-place, like [Weblate](https://weblate.org/) or
[GitLocalize](https://gitlocalize.com/). Such platforms require no additional integration, however
may lack some features since they can't be processed by
[plugins](/commands/build/localization/plugins).

Other platforms usually have an API that can be used to upload source strings and download
translated results. Localization providers enable such integration scenarios.

Currently Eaglesong includes one builtin custom provider, for [OneSky](https://www.oneskyapp.com/)
localization platform. It can be used by specifying a `provider` option:

```ts
const config: Options = {
  localization: {
    provider: {
      type: 'onesky',
      apiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      projectId: 123456,
    },
  },
};
```

The exact workflow with custom providers depends on the API that localization platform provides.
Uploading base strings usually requires a secret key, so has to be done during
[CI process](/environment#devops). Downloading results can be done differently:

- If API provides a secret-free way to download results, it can be done for every developer during
  build process. That's how it's done for OneSky provider.
- If secret is required, synchronizing translated results can be done in a scheduled task, updating
  results stored in the repository.
- If developers don't need to work with non-base language, fetching can be done only during publish
  process, so secret needs to be accessible only for publisher.
