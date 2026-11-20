import {
  createLocalCopyAdapter,
  createLocalSettingsAdapter,
  createSettingsStore,
  type LocalSettingsEnvironment,
  type SettingsStorageFailure,
  type SettingsStore,
} from "@self-engine/settings";
import {
  createSettingsPortAdapter,
  type SettingsPortConnection,
} from "@self-engine/settings-data/adapter";

/**
 * The app's Settings store. Device Settings stay in `localStorage`. With a Data Process, the
 * desktop app's, the Synced Settings live in the database and the page starts from their local
 * copy, the items the local adapter writes (D351); without one, on the web (D263), they stay in
 * `localStorage` too.
 */
export function createAppSettingsStore(
  environment: LocalSettingsEnvironment,
  data: SettingsPortConnection | undefined,
  onError: (failure: SettingsStorageFailure) => void,
): SettingsStore {
  const copy = createLocalSettingsAdapter(environment, "synced");
  return createSettingsStore({
    adapters: {
      synced:
        data === undefined
          ? copy
          : createLocalCopyAdapter({ copy, database: createSettingsPortAdapter(data), onError }),
      device: createLocalSettingsAdapter(environment, "device"),
    },
    onError,
  });
}
