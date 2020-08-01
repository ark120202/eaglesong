Object.assign(getfenv(1), {
  Activate(this: void) {
    ListenToGameEvent(
      'npc_spawned',
      (event) => {
        const unit = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC;
        if (unit.IsHero()) {
          unit.ModifyGold(1000, true, ModifyGoldReason.UNSPECIFIED);
        }
      },
      undefined,
    );
  },

  Precache(this: void, context: CScriptPrecacheContext) {
    PrecacheResource('soundfile', 'soundevents/custom.vsndevts', context);
  },
});
