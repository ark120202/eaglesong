# Sounds

This task manages `sounds` and `soundevents` resources.

Instead of storing `sounds` and `soundevents` in separate directories, with this task all source
files should be stored in `src/sounds`.

`soundevents` files should be written in Yaml format:

```yaml
Custom.Sound.Event:
  files: # `files` is an array that can include:
    - ./file.mp3 # relative to current source file paths
    - /file.mp3 # absolute (from `src/sounds` directory) source file paths
    - sounds/file.vsnd # references to builtin files
```

This task includes Yaml Schema to provide better development experience, like validation and
autocompletion (in [supported editors](/environment#editor-support)).
