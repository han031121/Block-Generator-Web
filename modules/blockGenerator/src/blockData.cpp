#include "blockData.hpp"

#include <cstdint>
#include <utility>

#ifdef __EMSCRIPTEN__
#include <chrono>
#endif

namespace
{
std::uint32_t makeRandomSeed()
{
#ifdef __EMSCRIPTEN__
    return static_cast<std::uint32_t>(
        std::chrono::high_resolution_clock::now().time_since_epoch().count()
    );
#else
    std::random_device rd;
    return rd();
#endif
}
}

// generateBlock
std::mt19937 mt(makeRandomSeed());

void blockData::generateBlock()
{
    init();

    if (allow_duplicate)
    {
        makeBlock();
        return;
    }

    if (!makeUniqueBlock())
    {
        init();
        is_generated = false;
    }
}

bool blockData::makeUniqueBlock()
{
    std::vector<int> available_counts;

    for (int target_count = block_count_pair.first; target_count <= block_count_pair.second; target_count++)
    {
        if (!exhausted_block_counts[target_count])
            available_counts.push_back(target_count);
    }

    while (!available_counts.empty())
    {
        std::uniform_int_distribution<int> distribution(0, static_cast<int>(available_counts.size()) - 1);
        int selected_index = distribution(mt);
        int target_count = available_counts[selected_index];

        block_count = target_count;

        if (makeUniqueBlock(target_count))
            return true;

        exhausted_block_counts[target_count] = true;
        available_counts.erase(available_counts.begin() + selected_index);
    }

    return false;
}

bool blockData::makeUniqueBlock(int target_count)
{
    auto& exhausted_states = exhausted_states_by_count[target_count];

    while (true)
    {
        init();

        BlockStateKey initial_key = getStateIdentify();
        std::vector<std::pair<Pair, double>> available_starts;
        double weight_sum = 0;

        auto add_start = [&](int r, int c)
        {
            int index = r * max_c + c;
            initial_key.setHeight(index, 1);

            if (exhausted_states.find(initial_key) == exhausted_states.end())
            {
                double weight = weight_field[r][c][1];

                if (weight > 0)
                {
                    available_starts.push_back({{r, c}, weight});
                    weight_sum += weight;
                }
            }

            initial_key.setHeight(index, 0);
        };

        for (int r = 0; r < max_r; r++)
            add_start(r, 0);
        for (int c = 1; c < max_c; c++)
            add_start(0, c);

        if (available_starts.empty() || weight_sum <= EPSILON)
            return false;

        std::uniform_real_distribution<double> distribution(0, weight_sum);
        double selected_weight = distribution(mt);
        int selected_index = static_cast<int>(available_starts.size()) - 1;

        for (int i = 0; i < static_cast<int>(available_starts.size()); i++)
        {
            selected_weight -= available_starts[i].second;

            if (selected_weight <= 0)
            {
                selected_index = i;
                break;
            }
        }

        start_point = available_starts[selected_index].first;
        int start_r = start_point.first;
        int start_c = start_point.second;

        cubic_data[start_r][start_c][1] = true;
        height_data[start_r][start_c] = 1;
        measureSize(std::make_tuple(start_r, start_c, 1));

        if (findUniqueCompletion(target_count))
            return true;
    }
}

bool blockData::findUniqueCompletion(int target_count)
{
    struct SizeSnapshot
    {
        int biggest_r;
        int biggest_c;
        int biggest_h;
        int smallest_r;
        int smallest_c;
        int size_r;
        int size_c;
        int size_h;
    };

    struct SearchFrame
    {
        bool expanded = false;
        bool has_parent = false;
        BlockStateKey state_key;
        std::vector<Transition> transitions;
        Tuple added_block;
        SizeSnapshot previous_size = {};
    };

    auto& exhausted_states = exhausted_states_by_count[target_count];
    std::vector<SearchFrame> stack;
    stack.reserve(target_count);
    stack.emplace_back();

    auto discard_current_state = [&]()
    {
        SearchFrame frame = std::move(stack.back());
        stack.pop_back();

        if (!frame.has_parent)
            return;

        int r = get<0>(frame.added_block);
        int c = get<1>(frame.added_block);
        int h = get<2>(frame.added_block);

        cubic_data[r][c][h] = false;
        height_data[r][c] = h - 1;
        biggest_r = frame.previous_size.biggest_r;
        biggest_c = frame.previous_size.biggest_c;
        biggest_h = frame.previous_size.biggest_h;
        smallest_r = frame.previous_size.smallest_r;
        smallest_c = frame.previous_size.smallest_c;
        size_r = frame.previous_size.size_r;
        size_c = frame.previous_size.size_c;
        size_h = frame.previous_size.size_h;
    };

    while (!stack.empty())
    {
        SearchFrame& current = stack.back();
        int current_count = static_cast<int>(stack.size());

        if (!current.expanded)
        {
            current.state_key = getStateIdentify();

            if (exhausted_states.find(current.state_key) != exhausted_states.end())
            {
                discard_current_state();
                continue;
            }

            if (current_count == target_count)
            {
                std::string final_key = getIdentify();

                if (created_list.find(final_key) == created_list.end())
                {
                    created_list.insert(std::move(final_key));
                    cacheExhaustedState(target_count, std::move(current.state_key));
                    is_generated = true;
                    return true;
                }

                cacheExhaustedState(target_count, std::move(current.state_key));
                discard_current_state();
                continue;
            }

            current.transitions = getAvailableTransitions(target_count);
            current.expanded = true;
        }

        if (current.transitions.empty())
        {
            cacheExhaustedState(target_count, std::move(current.state_key));
            discard_current_state();
            continue;
        }

        double weight_sum = 0;

        for (const auto& transition : current.transitions)
            weight_sum += transition.second;

        if (weight_sum <= EPSILON)
        {
            cacheExhaustedState(target_count, std::move(current.state_key));
            discard_current_state();
            continue;
        }

        std::uniform_real_distribution<double> distribution(0, weight_sum);
        double selected_weight = distribution(mt);
        int selected_index = static_cast<int>(current.transitions.size()) - 1;

        for (int i = 0; i < static_cast<int>(current.transitions.size()); i++)
        {
            selected_weight -= current.transitions[i].second;

            if (selected_weight <= 0)
            {
                selected_index = i;
                break;
            }
        }

        Tuple selected = current.transitions[selected_index].first;
        int r = get<0>(selected);
        int c = get<1>(selected);
        int h = get<2>(selected);

        SearchFrame child;
        child.has_parent = true;
        child.added_block = selected;
        child.previous_size = {
            biggest_r,
            biggest_c,
            biggest_h,
            smallest_r,
            smallest_c,
            size_r,
            size_c,
            size_h
        };

        current.transitions.erase(current.transitions.begin() + selected_index);

        cubic_data[r][c][h] = true;
        height_data[r][c] = h;
        measureSize(selected);
        stack.push_back(std::move(child));
    }

    return false;
}

std::vector<blockData::Transition> blockData::getCreatableTransitions()
{
    BlockStateKey state_key = getStateIdentify();
    auto cached = transition_cache.find(state_key);

    if (cached != transition_cache.end())
        return cached->second;

    std::vector<Transition> transitions;

    for (int r = 0; r < max_r; r++)
    {
        for (int c = 0; c < max_c; c++)
        {
            int h = height_data[r][c] + 1;

            if (h > max_h)
                continue;

            if (!isAdditionAdjacent(r, c, h) || !checkCreatable(r, c, h))
                continue;

            double weight = getWeight(r, c, h);

            if (weight > 0)
                transitions.push_back({std::make_tuple(r, c, h), weight});
        }
    }

    std::size_t estimated_bytes =
        sizeof(BlockStateKey) +
        sizeof(std::vector<Transition>) +
        transitions.size() * sizeof(Transition) +
        64;

    if (transition_cache_bytes + estimated_bytes <= TRANSITION_CACHE_BUDGET)
    {
        transition_cache.emplace(std::move(state_key), transitions);
        transition_cache_bytes += estimated_bytes;
    }

    return transitions;
}

std::vector<blockData::Transition> blockData::getAvailableTransitions(int target_count)
{
    auto& exhausted_states = exhausted_states_by_count[target_count];
    BlockStateKey child_key = getStateIdentify();
    std::vector<Transition> creatable_transitions = getCreatableTransitions();
    std::vector<Transition> available_transitions;
    available_transitions.reserve(creatable_transitions.size());

    for (const auto& transition : creatable_transitions)
    {
        int r = get<0>(transition.first);
        int c = get<1>(transition.first);
        int h = get<2>(transition.first);
        int index = r * max_c + c;
        std::uint8_t previous_height = child_key.getHeight(index);
        child_key.setHeight(index, static_cast<std::uint8_t>(h));
        bool is_exhausted = exhausted_states.find(child_key) != exhausted_states.end();
        child_key.setHeight(index, previous_height);

        if (!is_exhausted)
            available_transitions.push_back(transition);
    }

    return available_transitions;
}

bool blockData::isAdditionAdjacent(int r, int c, int h) const
{
    const int dr[4] = {-1, 0, 1, 0};
    const int dc[4] = {0, 1, 0, -1};

    if (height_data[r][c] > 0)
        return true;

    for (int direction = 0; direction < 4; direction++)
    {
        int next_r = r + dr[direction];
        int next_c = c + dc[direction];

        if (next_r < 0 || next_r >= max_r || next_c < 0 || next_c >= max_c)
            continue;

        if (height_data[next_r][next_c] >= h)
            return true;
    }

    return false;
}

void blockData::makeBlock()
{
    int current_count = 1;

    std::uniform_int_distribution<int> dis(block_count_pair.first, block_count_pair.second);
    block_count = dis(mt);

    setStartPoint();
    int start_r = start_point.first;
    int start_c = start_point.second;
    cubic_data[start_r][start_c][1] = 1;
    height_data[start_r][start_c] = 1;
    measureSize(std::make_tuple(start_r, start_c, 1));

    while (current_count < block_count)
    {
        std::vector<Transition> transitions = getCreatableTransitions();
        double weight_sum = 0;

        for (const auto& transition : transitions)
            weight_sum += transition.second;

        if (transitions.empty() || weight_sum <= EPSILON)
        {
            std::cout << "[ blockData ] Cannot generate block anymore. Block generated" << std::endl;
            is_generated = true;
            return;
        }

        std::uniform_real_distribution<double> distribution(0, weight_sum);
        double selected_weight = distribution(mt);
        Tuple selected = transitions.back().first;

        for (const auto& transition : transitions)
        {
            selected_weight -= transition.second;

            if (selected_weight <= 0)
            {
                selected = transition.first;
                break;
            }
        }

        int r = get<0>(selected);
        int c = get<1>(selected);
        int h = get<2>(selected);

        cubic_data[r][c][h] = true;
        height_data[r][c] = h;
        measureSize(selected);
        current_count++;
    }

    is_generated = true;
}

void blockData::setStartPoint()
{
    std::vector<std::pair<Pair, double>> weight_list;
    double weight_sum = 0;

    for (int i = 0; i < max_r; i++)
    {
        weight_sum += weight_field[i][0][1];
        weight_list.push_back({{i, 0}, weight_sum});
    }
    for (int j = 1; j < max_c; j++)
    {
        weight_sum += weight_field[0][j][1];
        weight_list.push_back({{0, j}, weight_sum});
    }

    std::uniform_real_distribution<double> dis_weight(0, weight_sum);
    double rand_weight = dis_weight(mt);

    for (std::pair<Pair, double> p : weight_list)
    {
        if (rand_weight > p.second)
            continue;
        start_point = p.first;
        break;
    }
}

// setWeight
bool blockData::checkCreatable(int r, int c, int h)
{
    if (r >= max_r || r < 0)
        return false;
    if (c >= max_c || c < 0)
        return false;
    if (h > max_h)
        return false;

    if (h > 1 && cubic_data[r][c][h - 1] == false)
        return false;

    if (!checkObscure(r, c, h))
        return false;

    return true;
}

bool blockData::checkObscure(int r, int c, int h)
{
    int check_r, check_c, check_h;

    if (r - 1 >= 0 && c + 1 < max_c)
    {
        check_r = r - 1;
        check_c = c;
        check_h = height_data[check_r][check_c];

        if (h > check_h && (height_data[r - 1][c + 1] > check_h || height_data[r][c + 1] > check_h))
            return false;
    }
    if (r - 1 >= 0 && c - 1 >= 0)
    {
        check_r = r - 1;
        check_c = c - 1;
        check_h = height_data[check_r][check_c];

        if (h > check_h && (height_data[r - 1][c] > check_h || height_data[r][c - 1] > check_h))
            return false;
    }
    if (r + 1 < max_r && c - 1 >= 0)
    {
        check_r = r;
        check_c = c - 1;
        check_h = height_data[check_r][check_c];

        if (h > check_h && (height_data[r + 1][c] > check_h || height_data[r + 1][c - 1] > check_h))
            return false;
    }

    return true;
}

double blockData::getWeight(int r, int c, int h)
{
    if (!checkCreatable(r, c, h))
        return 0;
    double mul = 1.0;
    double possibility = weight_field[r][c][h];

    possibility *= mul;
    return possibility;
}

void blockData::setWeight()
{
    for (int r = 0; r < max_r; r++)
    {
        for (int c = 0; c < max_c; c++)
        {
            double dist = r + c;
            for (int h = 0; h <= max_h; h++)
                weight_field[r][c][h] = DEFAULT_WEIGHT * exp(-DENSITY_COEFF * dist * density_var);
        }
    }
}

// setStatus
void blockData::init()
{
    std::fill(&cubic_data[0][0][0], &cubic_data[0][0][0] + MAX_SIZE * MAX_SIZE * (MAX_SIZE + 1), 0);
    std::fill(&height_data[0][0], &height_data[0][0] + MAX_SIZE * MAX_SIZE, 0);

    is_generated = false;
    biggest_r = 0;
    biggest_c = 0;
    biggest_h = 0;
    smallest_r = MAX_SIZE;
    smallest_c = MAX_SIZE;
    size_r = 0;
    size_c = 0;
    size_h = 0;
}

void blockData::measureSize(Tuple added)
{
    biggest_r = std::max(get<0>(added), biggest_r);
    biggest_c = std::max(get<1>(added), biggest_c);
    biggest_h = std::max(get<2>(added), biggest_h);
    smallest_r = std::min(get<0>(added), smallest_r);
    smallest_c = std::min(get<1>(added), smallest_c);

    size_r = biggest_r - smallest_r + 1;
    size_c = biggest_c - smallest_c + 1;
    size_h = biggest_h;
}

BlockStateKey blockData::getStateIdentify() const
{
    BlockStateKey key;

    for (int r = 0; r < max_r; r++)
    {
        for (int c = 0; c < max_c; c++)
        {
            key.setHeight(
                static_cast<std::size_t>(r * max_c + c),
                static_cast<std::uint8_t>(height_data[r][c])
            );
        }
    }

    return key;
}

void blockData::cacheExhaustedState(int target_count, BlockStateKey state)
{
    auto& exhausted_states = exhausted_states_by_count[target_count];

    if (exhausted_states.find(state) != exhausted_states.end())
        return;

    if (exhausted_state_count >= MAX_EXHAUSTED_STATE_COUNT)
        return;

    exhausted_states.insert(std::move(state));
    exhausted_state_count++;
}

std::string blockData::getIdentify() const
{
    std::string s = "";
    char hex[] = "0123456789ABCDEF";

    s += hex[size_r];
    s += hex[size_c];
    s += '_';

    for (int i = smallest_r; i <= biggest_r; i++)
    {
        for (int j = smallest_c; j <= biggest_c; j++)
        {
            char c = hex[height_data[i][j]];
            s += c;
        }
    }
    return s;
}

void blockData::printBlockData()
{
    std::cout << "----------------------" << std::endl;

    for (int i = smallest_r; i <= biggest_r; i++)
    {
        for (int j = smallest_c; j <= biggest_c; j++)
        {
            int h = height_data[i][j];
            if (h == 0)
                std::cout << ".";
            else
                std::cout << h;
            std::cout << " ";
        }
        std::cout << "\n";
    }

    std::cout << "row size : " << size_r << std::endl;
    std::cout << "col size : " << size_c << std::endl;

    std::tuple<float, float, float> center = getCenter();
    std::cout << "center : { " << std::get<0>(center) << ", " << std::get<1>(center) << ", " << std::get<2>(center) << " }" << std::endl;

    std::cout << "----------------------" << std::endl;
}
