import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { TextField, TextFieldProps } from '@mui/material';

type FormTextFieldProps = TextFieldProps & {
  name: string;
};

export const FormTextField: React.FC<FormTextFieldProps> = ({ name, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          {...props}
          error={!!error}
          helperText={error?.message || props.helperText}
          value={field.value !== undefined ? field.value : ''}
        />
      )}
    />
  );
};
