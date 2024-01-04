import React from 'react';
import { Alert } from './Alert';
import { fileReadAsBufferAsync, setupDragAndDrop } from '../dragAndDrop';
import { uint8ArrayToString } from '../util';
import { encodeIntoPng } from '../png';

export const PNGDialog = (props: { onClose: () => void }) => {
    const dropRef = React.useRef<HTMLDivElement>(null);
    const shareRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);
    const [image, setImage] = React.useState<string>();

    const { onClose } = props;

    React.useEffect(() => {
        if (dropRef.current) {
            setupDragAndDrop(dropRef.current!, file => true, async files => {
                const file = files[0];
                const buffer = await fileReadAsBufferAsync(file);

                setImage("data:image/png;base64," + btoa(uint8ArrayToString(buffer!)))
            });
        }
    });

    return (
        <Alert
            title="Encode project as PNG"
            text=""
            visible={true}
            className="png"
            onClose={onClose}
            options={[
                {
                    text: "No thanks",
                    onClick: onClose
                },
                {
                    text: "Do it",
                    onClick: () => {
                        encodeIntoPng(image!, shareRef.current!.value);
                    }
                }
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {
                    image ? <img src={image} alt="the thing you just uploaded" style={{ maxHeight: "100px", objectFit: "contain" }} /> :
                    <div className={`asset-drop ${dragging ? "dragging" : ""}`} ref={dropRef} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}>
                        Drop PNG file here
                    </div>
                }
                <div>
                    Share URL:
                </div>
                <input ref={shareRef} type="text" />
            </div>
        </Alert>
    )
}