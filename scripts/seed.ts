
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('🌱 Starting seed...');

    // 1. Create Projects
    const projectsData = [
        { name: 'Agency Artem', initials: 'AA', status: 'active', health_score: 85, goal: 100, achieved: 45 },
        { name: 'Agency Sasha', initials: 'AS', status: 'active', health_score: 92, goal: 150, achieved: 120 },
        { name: 'TechFlow Inc.', initials: 'TF', status: 'paused', health_score: 40, goal: 50, achieved: 10 },
    ] as const;

    const { data: projects, error: projectError } = await supabase
        .from('projects')
        .insert(projectsData)
        .select();

    if (projectError) {
        console.error('Error creating projects:', projectError);
        return;
    }
    console.log(`✅ Created ${projects.length} projects`);

    // 2. Create Scripts & Leads for each project
    for (const project of projects) {
        // Scripts
        const scriptsData = [
            { project_id: project.id, variant: 'A', name: 'Direct Offer', text: 'Hey, we can scale your leads...', sent_count: 150, conversion_count: 5 },
            { project_id: project.id, variant: 'B', name: 'Value First', text: 'Here is a free guide...', sent_count: 150, conversion_count: 12 },
        ] as const;

        await supabase.from('scripts').insert(scriptsData);

        // Leads
        const leadsData = Array.from({ length: 15 }).map((_, i) => ({
            project_id: project.id,
            name: `Lead ${i + 1} (${project.initials})`,
            status: ['new', 'hook_sent', 'dialog', 'zoom_booked', 'closed'][Math.floor(Math.random() * 5)],
            platform: ['telegram', 'linkedin', 'vk'][Math.floor(Math.random() * 3)],
            agent_name: ['Artem', 'Sasha'][Math.floor(Math.random() * 2)],
        })) as any[]; // cast to any to avoid strict union matching issues in map for now

        await supabase.from('leads').insert(leadsData);
    }

    console.log('✅ Created Scripts and Leads');
    console.log('🎉 Seed completed successfully!');
}

seed().catch(console.error);
