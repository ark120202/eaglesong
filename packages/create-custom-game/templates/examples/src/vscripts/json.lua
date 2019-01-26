function Array:isArray(v)
  return v.length ~= nil and v.map ~= nil and v.splice ~= nil
end

JSON = {}

local function makeArrays(obj)
  local meta = getmetatable(obj)
  if meta and meta.__jsontype == "array" then
    return Array(nil, Reflect:unpack(obj))
  elseif type(obj) == "table" then
    for k, v in pairs(obj) do
      obj[k] = makeArrays(v)
    end
  end
  return obj
end

function JSON:parse(str)
  local result = json.decode(str)
  return makeArrays(result)
end

local function traverse(obj, map)
  local res = {}
  local isArray = Array:isArray(obj)
  for k, v in pairs(obj) do
    if not (isArray and k == "length") then
      if type(v) == "table" then
        res[k] = traverse(v)
      elseif map ~= nil then
        res[k] = map(v)
      else
        res[k] = v
      end
    end
  end
  return res
end

function JSON:stringify(obj, indent, map)
  obj = traverse(obj, map)
  local result = json.encode(obj, { indent = indent ~= nil })
  return result
end
