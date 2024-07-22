import React from 'react';
import '../styles/TextList.css';
import { TextBox } from './TextBox';

interface Props {
    text: string[];
}

export const TextList = (props: Props) => {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const div = ref.current!;
        const elements = div.children;
        let index = 0;

        const moveSelection = (delta: number) => {
            if (delta === 1 && index === elements.length - 1) return;
            else if (delta === -1 && index === 0) return;

            const current = elements.item(index) as HTMLDivElement;
            index = (index + elements.length + delta) % elements.length;
            const next = elements.item(index) as HTMLDivElement;

            current.classList.remove("selected");
            next.classList.add("selected");

            const rect = next.getBoundingClientRect();

            if (!delta) return;

            if (!(
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            )) {
                next.scrollIntoView(delta < 0);
            }
        }

        for (let i = 0; i < elements.length; i++) {
            (elements.item(i)! as HTMLDivElement).addEventListener("pointerdown", () => {
                moveSelection(i - index);
            })
        }

        div.addEventListener("keydown", ev => {
            if (ev.key === "ArrowDown") {
                moveSelection(1);
                ev.preventDefault();
                ev.stopPropagation();
            }
            else if (ev.key === "ArrowUp") {
                moveSelection(-1);
                ev.preventDefault();
                ev.stopPropagation();
            }
            else if (ev.key === "Home") {
                moveSelection(-index);
                ev.preventDefault();
                ev.stopPropagation();
            }
            else if (ev.key === "End") {
                moveSelection(div.children.length - index - 1);
                ev.preventDefault();
                ev.stopPropagation();
            }
        });
    });

    return (
        <div className="asset-file-content text-list" ref={ref} tabIndex={0}>
            {props.text.map(text => <TextBox key={text} text={text} />)}
        </div>
    );
}