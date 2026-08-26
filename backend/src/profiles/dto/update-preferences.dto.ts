import { IsIn, IsOptional } from 'class-validator';

/** What the farmer said they came here to do. Routes first-run, grants nothing. */
export const SIGNUP_INTENTS = ['own_farm', 'work_on_farm'] as const;
export type SignupIntent = (typeof SIGNUP_INTENTS)[number];

/**
 * The ONLY shape a client may write into `users.preferences`.
 *
 * That column is free-form `jsonb`, which makes it a tempting place to stash
 * anything and a dangerous one to accept anything into. W3 removed
 * `accountType` precisely because a client-supplied flag on the user row was
 * being read for an authorization decision. Persisting the onboarding intent
 * re-creates the *shape* of that mistake; this DTO, the service-side whitelist
 * and `preferences-not-authorization.spec.ts` are together what stop it
 * becoming the mistake itself.
 *
 * The global ValidationPipe runs with `whitelist: true`, so anything not
 * declared here is stripped before the controller ever sees it.
 */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(SIGNUP_INTENTS as unknown as string[])
  onboardingIntent?: SignupIntent;
}
