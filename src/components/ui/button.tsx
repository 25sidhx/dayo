import React from 'react';
import { Button as RadixButton } from '@radix-ui/react-button';

const Button = ({children, onClick, variant = 'default', ...props}) => {
  return (
    <RadixButton
      onClick={onClick}
      className={`button ${variant}`}
      {...props}
    >
      {children}
    </RadixButton>
  );
};

export default Button;