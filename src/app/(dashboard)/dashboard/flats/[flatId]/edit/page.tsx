import React from 'react';
import FlatForm from '../../FlatForm';

interface Props {
  params: { flatId: string };
}

export default function EditFlatPage({ params }: Props) {
  return <FlatForm flatId={params.flatId} />;
}
