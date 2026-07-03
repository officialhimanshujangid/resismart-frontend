import React, { ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { TextField, TextFieldProps } from '@mui/material';

type FormSelectProps = TextFieldProps & {
  name: string;
  children: ReactNode;
};

export const FormSelect: React.FC<FormSelectProps> = ({ name, children, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          {...props}
          select
          error={!!error}
          helperText={error?.message || props.helperText}
          value={field.value !== undefined ? field.value : ''}
        >
          {children}
        </TextField>
      )}
    />
  );
};
