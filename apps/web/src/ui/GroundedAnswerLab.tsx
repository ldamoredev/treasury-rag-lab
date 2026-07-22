import type {
  GroundedAnswerLabPresenter,
  GroundedAnswerLabViewModel,
} from "../presenters/GroundedAnswerLabPresenter";
import { GroundedAnswerChat } from "./groundedAnswer/GroundedAnswerChat";
import { GroundedAnswerInspector } from "./groundedAnswer/GroundedAnswerInspector";

type GroundedAnswerLabProps = {
  presenter: GroundedAnswerLabPresenter;
  model: GroundedAnswerLabViewModel;
};

export function GroundedAnswerLab({ presenter, model }: GroundedAnswerLabProps) {
  function revealCitation(citationId: string) {
    presenter.selectInspectorTab("context");
    window.setTimeout(() => {
      const source = document.getElementById(`source-${citationId}`);
      source?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      source?.focus({ preventScroll: true });
    });
  }

  return (
    <main className="rag-workbench">
      <GroundedAnswerChat
        presenter={presenter}
        model={model}
        onRevealCitation={revealCitation}
      />
      <GroundedAnswerInspector presenter={presenter} model={model} />
    </main>
  );
}
