# Sounds

In Eaglesong sounds-related features are provided by [task-sounds](../internals/task-sounds) plugin.

To add a new sound you need to create a .yml file in a sounds directory. This is a soundevents file,
which is a key-value structure, where key is a string that identifies a sound.

```yaml
Custom.Explosion: # The unique id of a sound.
  soundlevel: 85
  files: # files is the only required field
    - ./test.mp3 # files starting with a ./ are relative to a .yml file
    - /test2.wav # files starting with a / are relative to sounds directory root
    - sounds/
```
