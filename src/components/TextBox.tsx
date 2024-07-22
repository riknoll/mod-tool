import React from 'react';
import '../styles/TextBox.css';

interface Props {
    text: string;
}

export const TextBox = (props: Props) => {
    return (
        <div className="text-box">
            {props.text}
        </div>
    );
}