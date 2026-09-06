import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Reject a payload whose every listed field is empty (L2 / D2).
 *
 * A parameter log with no parameters saves happily today, and the damage is
 * not the empty row — it is that the app then TELLS THE FARMER THEY ARE DONE.
 * `logProgress.pondSlotDone` asks only whether a record exists in the slot, not
 * whether it contains anything, so a blank save stops the reminder, turns the
 * Today card green and holds the streak. Meanwhile every `*AsOf` stays old, so
 * `computeConfidence` correctly keeps decaying and the engines quietly go
 * vague. The optimistic half is the only half the farmer is ever shown.
 *
 * Enforced HERE as well as on the client on purpose. Client-only leaves the
 * offline queue able to write empties — a record queued by an older build
 * drains into an empty row long after the screen that made it is gone.
 * Server-only means the farmer finds out at drain time instead of at the form.
 * The parity is the point.
 *
 * A rejected record parks in `failedOperations` rather than vanishing, which
 * is the correct outcome: visible, and recoverable by hand.
 *
 * NOTE ON `null`: an explicit null counts as empty, not as a value. Clients
 * send `null` for "cleared this field", and a row of nulls is exactly the
 * thing being refused. `0` is a real reading (DO can be zero, and that is an
 * emergency worth logging) and is deliberately NOT empty.
 */
export function AtLeastOneOf(
  fields: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'atLeastOneOf',
      target: object.constructor,
      propertyName,
      constraints: [fields],
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const [names] = args.constraints as [string[]];
          const dto = args.object as Record<string, unknown>;
          return names.some((n) => {
            const v = dto[n];
            // Empty string is a blank input box, not a measurement.
            return v !== undefined && v !== null && v !== '';
          });
        },
        defaultMessage(args: ValidationArguments) {
          const [names] = args.constraints as [string[]];
          return `At least one of the following must have a value: ${names.join(', ')}`;
        },
      },
    });
  };
}
