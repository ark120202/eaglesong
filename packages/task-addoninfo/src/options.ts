export interface Options {
  /**
   * Enables check for AFK / Fountain idling players.
   *
   * @default false
   */
  CheckAFKPlayers?: boolean;

  /**
   * Enables leave penalties.
   *
   * @default false
   */
  PenaltiesEnabled?: boolean;

  /** @default true */
  HeroGuidesSupported?: boolean;

  /** @default true */
  ShouldForceDefaultGuide?: boolean;

  /**
   * Enables ban phase.
   *
   * @default false
   */
  EnablePickRules?: boolean;

  /**
   * Binds keys to console commands.
   */
  Default_Keys?: DefaultKey[];
}

export interface DefaultKey {
  Key: string;
  Command: string;
  Name: string;
}
