import React from 'react';
import FlatForm from '../../FlatForm';

/**
 * `params` is a Promise in this version of Next and has to be awaited.
 *
 * Read synchronously it yields `undefined`, so the form was handed no flat id,
 * never fetched, and sat there blank — which reads as "the data didn't load"
 * rather than as a routing mistake.
 */
export default async function EditFlatPage({ params }: { params: Promise<{ flatId: string }> }) {
  const { flatId } = await params;
  return <FlatForm flatId={flatId} />;
}
