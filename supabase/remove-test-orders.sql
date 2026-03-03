-- ==============================================================================
-- CLEANUP: Remove test orders inserted during debugging
-- ==============================================================================
-- This script safely removes the random test orders created from 'table 10' 
-- with a total of $15.00 that were inserted while fixing the RLS permission issue.

DELETE FROM public.order_items 
WHERE order_id IN (
    SELECT id FROM public.orders 
    WHERE table_number = '10' AND total = 15 AND status = 'new'
);

DELETE FROM public.orders 
WHERE table_number = '10' AND total = 15 AND status = 'new';
