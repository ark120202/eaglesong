declare function validate(options: validate.Options): boolean;
declare namespace validate {
  interface Options {
    exit?: boolean;
    log?: boolean;
    name: string;
    schema: string | object;
    target: object;
    throw?: boolean;
  }
}

export = validate;
