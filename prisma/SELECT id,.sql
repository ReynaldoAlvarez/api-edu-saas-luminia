SELECT id,
       name,
       slug,
       "contactEmail",
       phone,
       address,
       "planId",
       settings,
       status,
       "createdAt"
FROM public."Institution"
LIMIT 1000;