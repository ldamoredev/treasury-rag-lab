import {
  useEffect,
  useMemo,
  useState,
  type DependencyList,
} from "react";

type PresenterLifecycle = {
  start(): void;
  stop(): void;
};

export function usePresenter<Presenter extends PresenterLifecycle>(
  factory: (onChange: () => void) => Presenter,
  dependencies: DependencyList,
  active: boolean,
): Presenter {
  const [, setRevision] = useState(0);
  const presenter = useMemo(
    () => factory(() => setRevision((revision) => revision + 1)),
    dependencies,
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    presenter.start();
    return () => presenter.stop();
  }, [active, presenter]);

  return presenter;
}
